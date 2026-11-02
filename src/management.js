import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {windowsWritePrivateFile} from '@dot-bridge/core/platform';
import {readPrivateFile,openPrivateDirectory} from '@dot-bridge/core/platform/private-files.js';
import {components,channelIds} from './components.js';
import {assertNode,readManifest,validateManifest,prepare,prepareStatus} from './config.js';
import {inspectChannels} from './status.js';
import {inspectMcp} from './rpc.js';
import {onboarding} from './onboarding.js';

const installation=fileURLToPath(new URL('../',import.meta.url));
const assets=new Map([['/',['management-ui.html','text/html; charset=utf-8']],['/app.js',['management-ui.js','text/javascript; charset=utf-8']],['/app.css',['management-ui.css','text/css; charset=utf-8']]]);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const enumValue=(value,values)=>values.includes(value)?value:null;
const errorCodes=new Set(['configuration_invalid','manifest_unavailable','environment_unsafe','python_required','backend_configuration','mode_mismatch','listener_invalid','callback_config_name','configuration_conflict','service_key_unsafe','service_keys_reused','router_configuration','port_mismatch']);
class ManagementError extends Error {constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const failure=(status,code,message)=>new ManagementError(status,code,message);
const safeError=error=>({ok:false,error:errorCodes.has(error?.code)?error.code:enumValue(error?.code,['request_invalid','confirmation_required','configuration_changed','private_manifest_required','release_unavailable','release_invalid','release_directory_required','demo_read_only'])??'operation_failed',message:error instanceof ManagementError?error.message:'操作未完成。请核对配置和运行用户；私有值未返回到页面。'});
const samePath=(left,right)=>process.platform==='win32'?left.toLowerCase()===right.toLowerCase():left===right;
const regular=(file,maxBytes)=>{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>maxBytes||!samePath(fs.realpathSync(file),path.resolve(file)))throw Error();return fs.readFileSync(file);};
const json=(file,maxBytes=131072)=>JSON.parse(regular(file,maxBytes));
const plainManifest=m=>({version:m.version,mode:m.mode,channels:{...m.channels},routerEnv:m.routerEnv,dataDirectory:m.dataDirectory,systemd:{...m.systemd}});
const revision=m=>digest(Buffer.from(JSON.stringify(plainManifest(m))));
const safeName=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/u.test(value)&&value!=='.'&&value!=='..';
const positiveInt=value=>Number.isSafeInteger(value)&&value>=0&&value<=2147483647;

export function channelPresentation(value,{selected=true,mode='live',now=Date.now()}={}) {
  if(!selected)return {state:'not_selected',label:'未选用',tone:'quiet',detail:'当前清单未选择此渠道，不会启动或停止已有服务。'};
  if(value?.configurationError)return {state:'configuration_error',label:'配置待完善',tone:'warning',detail:'检查私有文件、运行用户及所需配置。'};
  if(!value?.authenticatedMcpReachable)return {state:'unreachable',label:'服务未连接',tone:'warning',detail:'先确认对应桥服务已启动。'};
  if(mode==='readiness')return {state:'readiness',label:'仅预检',tone:'quiet',detail:'当前模式不连接真实聊天账号。'};
  if(value.bindingReady===false)return {state:'needs_pairing',label:'待本人配对',tone:'warning',detail:'在私密终端完成本人确认，再刷新状态。'};
  if(value.connectionStatus?.stage==='callback_policy')return {state:'callback_policy',label:'通知域名待核对',tone:'warning',detail:'原 dot 的通知地址需要核对批准。请在接入页查看实际配置及脱敏诊断。'};
  // Lark and QQ deliberately wait for an authorized subscription before
  // starting their gateway. Preserve the observed false value and explain
  // that dependency instead of diagnosing a network failure.
  if(value.connectionStatus?.stage==='subscription'&&value.subscriptionActive!==true){
    if(value.subscriptionStatus?.state==='expired')return {state:'subscription_expired',label:'订阅已到期',tone:'warning',detail:value.gatewayConnected===false?'平台连接正在等待原 dot 续订，请先恢复原事件订阅。':'请原 dot 续订原事件任务，再确认自动回复。'};
    if(value.subscriptionStatus?.state==='disabled')return {state:'subscription_disabled',label:'订阅已停用',tone:'quiet',detail:'请原 dot 确认是否恢复原事件订阅，再核对平台连接。'};
    if(value.connectionStatus.reason==='subscription_failed')return {state:'subscription_error',label:'订阅尚未完成',tone:'warning',detail:'先查看上次请求的脱敏诊断，再由原 dot 处理，避免连续重复创建。'};
    if(value.connectionStatus.reason==='subscription_unknown')return {state:'unknown',label:'订阅待核对',tone:'quiet',detail:'现有记录无法确认有效性，请原 dot 检查原任务，确认前不重复创建。'};
    return {state:'needs_subscription',label:'待 dot 订阅',tone:'warning',detail:value.gatewayConnected===false?'请原 dot 完成事件订阅；此渠道会在订阅有效后继续连接平台。':'请原 dot 完成事件订阅，再从本人私聊确认自动回复。'};
  }
  if(value.gatewayConnected===false)return {state:'gateway_offline',label:'平台未连接',tone:'warning',detail:'检查平台登录、网络连接及旧消费者是否已停止。'};
  if(value.subscriptionActive!==true&&value.subscriptionStatus?.state==='expired')return {state:'subscription_expired',label:'订阅已到期',tone:'warning',detail:'请原 dot 恢复或续订此渠道。'};
  if(value.subscriptionActive!==true&&value.subscriptionStatus?.state==='disabled')return {state:'subscription_disabled',label:'订阅已停用',tone:'quiet',detail:'请在原 dot 确认是否恢复此渠道。'};
  if(value.subscriptionActive===false)return {state:'needs_subscription',label:'待 dot 订阅',tone:'warning',detail:'平台连接不等于自动回复。请原 dot 完成事件订阅。'};
  if(value.bindingReady===true&&value.gatewayConnected===true&&value.subscriptionActive===true){
    const expires=Date.parse(value.subscriptionStatus?.expiresAt??'');
    if(Number.isFinite(expires)&&expires<=now)return {state:'subscription_expired',label:'订阅已到期',tone:'warning',detail:'请原 dot 续订后再核对收发。'};
    if(Number.isFinite(expires)&&expires-now<86400000)return {state:'expiring',label:'订阅即将到期',tone:'warning',detail:'订阅由原 dot 续订；请关注下次刷新结果。'};
    return {state:'ready',label:'链路就绪',tone:'good',detail:Number.isFinite(expires)?'绑定、平台网关和订阅已就绪。可从本人私聊确认回复。':'绑定、平台网关和订阅已就绪；当前组件未提供有效期。'};
  }
  return {state:'unknown',label:'状态待核对',tone:'quiet',detail:value.subscriptionActive===true?'订阅当前有效，其余连接信息待核对。':'当前组件未提供完整连接状态，不据配置猜测。'};
}

const commands={
  lark:['node node_modules/dot-lark-bridge/scripts/setup.js pair --credentials <受保护的应用文件> --binding <新的私有绑定文件> --confirm-bind'],
  qq:['node node_modules/dot-qq-bridge/scripts/qq-official-scan.js --plan','node node_modules/dot-qq-bridge/scripts/qq-official-scan.js --scan --confirm-official-scan --confirm-scanner-is-owner --expected-app-id <已核验的原应用ID>'],
  dingtalk:['node node_modules/dot-dingtalk-bridge/scripts/pair-owner.js --app-credentials-file <私有应用文件> --output <新的私有绑定文件> --confirm-stopped --confirm-private-storage'],
  wecom:['node node_modules/dot-wecom-bridge/scripts/pair-owner.js --app-credentials-file <私有应用文件> --output <新的私有绑定文件> --confirm-stopped --confirm-private-storage'],
  weixin:['node node_modules/dot-weixin-bridge/scripts/login.js --credentials-file <新的私有绑定文件> --confirm-private-storage --confirm-stopped'],
  telegram:['node node_modules/dot-telegram-bridge/scripts/pair-owner.js --token-file <私有Token文件> --credentials-file <新的私有绑定文件> --confirm-stopped --confirm-private-storage'],
  discord:[],line:[]
};
export function setupGuide(id,value) {
  const item=onboarding[id];
  return {steps:[...item.steps],console:item.console??null,credentials:[...item.credentials],commands:commands[id],
    binding:typeof value?.bindingReady==='boolean'?value.bindingReady:null,
    pairingNotice:value?.bindingReady===true?'已有本人绑定，请保留原文件；不要重新配对或覆盖。':value?.bindingReady===false?'本人配对尚未就绪。先确认旧消费者已停止，并在私密终端按组件引导操作。':'当前尚未核对本人绑定。先检查既有私有文件与服务；已有绑定应继续沿用，不要重复配对。',
    subscriptionPrompt:`请先检查现有 ${id}.message.created 事件任务，已有则复用并核对或续订原订阅；确认尚无才通过现有 dot Bridge Tunnel 创建一次，限定 conversation=owner。用 get_${id}_message 读取、reply_to_${id} 回复文字；支持的附件用 get_${id}_attachment 读取，需回发原附件时用 reply_${id}_attachment 按编号操作。每条原消息只选择一个最终回复，不重复发送。文件摘录标记为 truncated 时只是一部分，语音转写不代表听到了原音频。使用你真实生成的 callback。若需批准回调域名，请只报告精确域名，等待本人确认。若失败，只报告实际 RPC code、脱敏 reason 和 hostname，不显示完整 callback 或签名密钥，也不要连续重复创建。`,
    outboundPrompt:`请先通过现有 dot Bridge Tunnel 调用 check_${id}_outbound。仅在本人明确要求且 enabled=true 时安排主动文字或提醒，目标只允许已绑定的本人私聊。固定文字用 schedule_${id}_message 保存，核对发送时间、IANA 时区和重复提醒结束日期，并回报返回的提醒编号。修改或取消使用原编号与当前 revision。动态内容需你真正保存定时任务，到点调用 send_${id}_message，每个时段沿用稳定幂等键；未保存成功不能声称已安排。保持现有事件订阅，不自动重发 uncertain。`,
    guide:`node_modules/${item.guide}`};
}

function releaseInfo(root=installation){
  const pkg=json(path.join(root,'package.json')),lock=json(path.join(root,'components.lock.json'));
  if(pkg.name!=='dot-bridge'||!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/u.test(pkg.version)||lock.schemaVersion!==1)throw Error();
  return {version:pkg.version,components:Object.entries(lock.components).map(([id,item])=>({id,version:item.version}))};
}
function candidateManifest(current,selected){
  if(!Array.isArray(selected)||!selected.length||selected.length>8||new Set(selected).size!==selected.length||selected.some(id=>!channelIds.includes(id)))throw failure(400,'request_invalid','请选择至少一个已支持的渠道。');
  const channels=Object.fromEntries(selected.map(id=>[id,current.channels[id]??path.join(path.dirname(current.routerEnv),id==='qq'&&current.mode==='live'?'qq-live.env':`${id}.env`)]));
  return validateManifest({...plainManifest(current),channels},current.file);
}
function writeManifest(current,candidate,expected){
  if(expected!==revision(current))throw failure(409,'configuration_changed','配置已被其他操作更新，请先刷新页面。');
  let parent,old,temp;const suffix=randomBytes(8).toString('hex'),base=path.basename(current.file),backup=`${base}.before-ui-${suffix}.json`;
  try{
    parent=openPrivateDirectory(path.dirname(current.file));
    old=readPrivateFile(current.file,{maxBytes:65536});
    if(revision(readManifest(current.file))!==expected)throw failure(409,'configuration_changed','配置已变化，请刷新后重试。');
    const stat=fs.lstatSync(current.file),target=path.join(parent.path,base);
    const write=(name,bytes)=>{const out=path.join(parent.path,name);if(process.platform==='win32')windowsWritePrivateFile(out,bytes);else{const fd=fs.openSync(out,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}return out;};
    write(backup,old);
    temp=write(`.${base}.ui-${suffix}`,Buffer.from(JSON.stringify(plainManifest(candidate),null,2)+'\n'));
    const latest=fs.lstatSync(target);
    if(latest.ino!==stat.ino||latest.dev!==stat.dev||revision(readManifest(current.file))!==expected)throw failure(409,'configuration_changed','配置已变化，未覆盖其他修改。');
    fs.renameSync(temp,target);temp=undefined;
    return {saved:true,backupCreated:true,restartRequired:true,credentialsChanged:false,subscriptionsChanged:false};
  }catch(error){if(error instanceof ManagementError)throw error;throw failure(409,'private_manifest_required','清单未保存。请以最终运行用户操作，并确保清单及目录通过私有权限和链接检查。');}
  finally{old?.fill(0);if(temp){try{fs.unlinkSync(temp);}catch{}}parent?.close();}
}

function releaseDirectory(root,id){
  if(!root)throw failure(409,'release_directory_required','启动界面时使用 --releases-dir 指定已有发行目录的父目录。');
  if(!safeName(id))throw failure(400,'request_invalid','请选择列表中的发行版本。');
  const base=path.resolve(root),target=path.join(base,id);
  try{if(!samePath(fs.realpathSync(base),base)||!fs.lstatSync(target).isDirectory()||fs.lstatSync(target).isSymbolicLink()||!samePath(fs.realpathSync(target),target))throw Error();}catch{throw failure(404,'release_unavailable','该发行目录不可用，或包含链接。');}
  return target;
}
export function availableReleases(root){
  if(!root)return [];
  let names;try{names=fs.readdirSync(root).filter(safeName).slice(0,80);}catch{return [];}
  return names.flatMap(id=>{try{const info=releaseInfo(releaseDirectory(root,id));return [{id,version:info.version}];}catch{return [];}}).slice(0,30);
}
export function verifyRelease(root,id,current){
  const target=releaseDirectory(root,id);
  try{
    const pkg=json(path.join(target,'package.json')),locked=json(path.join(target,'package-lock.json'),2097152),manifest=json(path.join(target,'components.lock.json'));
    if(pkg.name!=='dot-bridge'||manifest.schemaVersion!==1||Object.keys(manifest.components).sort().join(',')!=='core,dingtalk,discord,lark,line,qq,telegram,wecom,weixin')throw Error();
    if(locked.name!==pkg.name||locked.version!==pkg.version||locked.packages?.['']?.version!==pkg.version)throw Error();
    for(const [id,item] of Object.entries(manifest.components)){
      const expectedPackage=id==='core'?'@dot-bridge/core':`dot-${id}-bridge`,expectedFile=id==='core'?'dot-bridge-core':expectedPackage;
      if(item.package!==expectedPackage||!/^\d+\.\d+\.\d+$/u.test(item.version)||item.artifact!==`vendor/${expectedFile}-${item.version}.tgz`||locked.packages?.[`node_modules/${item.package}`]?.version!==item.version)throw Error();
      if(!/^[a-f0-9]{40}$/u.test(item.revision)||!/^vendor\/dot-[a-z-]+-[0-9.]+\.tgz$/u.test(item.artifact)||!/^[a-f0-9]{64}$/u.test(item.sha256))throw Error();
      const bytes=regular(path.join(target,item.artifact),67108864);
      if(digest(bytes)!==item.sha256||pkg.dependencies?.[item.package]!=='file:'+item.artifact||locked.packages?.[`node_modules/${item.package}`]?.integrity!=='sha512-'+createHash('sha512').update(bytes).digest('base64'))throw Error();
    }
    const info=releaseInfo(target),installed=releaseInfo(),before=new Map(installed.components.map(c=>[c.id,c.version]));
    const [major,minor]=process.versions.node.split('.').map(Number);
    return {id,version:info.version,integrityVerified:true,sourceReviewRequired:true,
      components:info.components.map(item=>({...item,currentVersion:before.get(item.id)??null,changed:before.get(item.id)!==item.version})),
      compatibility:{manifestSchemaSupported:current.version===1,selectedChannelsAvailable:current.selected.every(name=>Object.hasOwn(manifest.components,name)),nodeVersionCompatible:major===24&&minor>=15&&pkg.engines?.node==='>=24.15 <25',targetDoctorRequired:true}};
  }catch{throw failure(409,'release_invalid','发行目录的包、哈希或锁文件不一致，不能作为切换目标。');}
}

const shellQuote=value=>process.platform==='win32'?"'"+value.replaceAll("'","''")+"'":"'"+value.replaceAll("'","'\\''")+"'";
export function upgradeRunbook(result,current,work){
  const config=shellQuote(current.file);
  const output=shellQuote(path.join(path.dirname(current.file),'systemd-proposed-'+result.version+'-'+randomBytes(4).toString('hex')));
  const confirm=current.mode==='live'?' --confirm-live':'';
  const queue=work.known?'pending='+work.pending+'，processing='+work.processing+'，uncertain='+work.uncertain:'当前组件未提供完整计数，需在最终主机核对；不能以页面引用数量替代。';
  return [
    'DotBridge 升级操作单','',
    '当前版本：'+releaseInfo().version,
    '目标目录：'+result.id,
    '目标版本：'+result.version,
    '运行模式：'+current.mode,
    '安装包完整性：已检查，与发行清单及锁文件一致',
    '来源审核：仍需管理员确认该发行版经过审核',
    '目标配置检查：仍需使用目标发行版执行 doctor','',
    '本次预检未停止、重启、安装或切换任何服务，未修改凭据和订阅。','',
    '切换前检查',
    '1. 确认同一应用只有一个收发消费者。',
    '2. 核对完整持久队列：'+queue,
    '3. 存在 pending、processing 或 uncertain 时，不删除、改状态或自动重发；先处理或安排停机。',
    '4. 以最终运行用户执行当前发行版的 doctor。',
    '5. 由管理员优雅停止原服务（180秒停止宽限），完成 SQLite 一致性备份或停机后的主库/WAL/SHM完整备份；保留原 STORAGE_KEY 和身份绑定。',
    '6. 保存当前发行目录、依赖和 systemd 单元，记录备份位置。','',
    '管理员准备目标依赖',
    '进入上面列出的目标发行目录，使用 Node 24（至少24.15，低于25）及其 npm：',
    'npm ci --omit=dev --ignore-scripts --no-audit --no-fund','',
    '以最终运行用户检查（须能读取原私有配置，不能换成 root 绕过权限检查）',
    'node bin/dotbridge.js doctor --config '+config,'',
    '管理员切换',
    '核对所选渠道、原私有配置与数据目录，再通过原部署流程切换 systemd 的绝对路径；不要把两套服务同时启动。',
    '若需要新单元，在目标发行目录中生成到这个尚未创建的目录，先供管理员核对：',
    'node bin/dotbridge.js service render --config '+config+' --output '+output,'',
    '安装核对后的单元，daemon-reload 后启动原目标：',
    'node bin/dotbridge.js service start --config '+config+confirm,
    '然后以最终运行用户检查：',
    'node bin/dotbridge.js status --config '+config,'',
    '用本人私聊确认多个不同消息各回复一次。普通服务重启后再次确认，断开部署电脑后检查仍运行。整机重启须另外安排。','',
    '回滚',
    '确认没有旧版无法处理的媒体队列或结果不明任务。保留当前数据库，不用旧快照覆盖新收到的消息；切回保存的发行目录与单元并重新 doctor。未知结果保持 uncertain，不补发。目标版本的数据兼容性与 QQ 媒体历史需按对应组件说明核对。','',
    '订阅',
    '使用原 dot 的真实订阅与续订流程，不猜 callback、不重复创建、不扩大回调域名。',''
  ].join('\n');
}

function workSummary(channels){
  const selected=channels.filter(c=>c.selected);const known=selected.length>0&&selected.every(c=>c.replyWork&&['pending','processing','uncertain'].every(k=>positiveInt(c.replyWork[k])));
  return {known,pending:known?selected.reduce((n,c)=>n+c.replyWork.pending,0):null,processing:known?selected.reduce((n,c)=>n+c.replyWork.processing,0):null,uncertain:known?selected.reduce((n,c)=>n+c.replyWork.uncertain,0):null};
}
function demoState(){
  const expiry=new Date(Date.now()+2*86400000).toISOString(),values={lark:{authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:true},qq:{authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:true},telegram:{authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:false,callbackHostCount:1,subscriptionDiagnostics:[{at:new Date().toISOString(),stage:'challenge',code:-32015,reason:'challenge_failed',hostname:'callback.example.com'}]},weixin:{authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:false,subscriptionActive:false}};
  const channels=channelIds.map(id=>{const value=values[id]??{};return {id,name:components[id].name,selected:Object.hasOwn(values,id),...value,subscriptionStatus:value.subscriptionActive?{state:'active',expiresAt:expiry,remainingSeconds:172800,renewalOwner:'host'}:null,subscriptionDiagnostics:value.subscriptionDiagnostics??[],replyWork:null,presentation:channelPresentation(value,{selected:Object.hasOwn(values,id)}),guide:setupGuide(id,value)};});
  return {demo:true,mode:'live',configurationAvailable:true,revision:'demo',installation:releaseInfo(),routerReachable:true,updatedAt:new Date().toISOString(),channels,releaseSelectionAvailable:false,work:workSummary(channels),notice:'演示数据，不连接任何平台，不读写真实配置。'};
}

export async function collectManagementState({configFile,releasesDir,inspect=inspectMcp,inspectStatus=inspectChannels}={}){
  let manifest;try{manifest=readManifest(configFile);}catch{return {demo:false,mode:null,configurationAvailable:false,revision:null,installation:releaseInfo(),routerReachable:null,updatedAt:new Date().toISOString(),channels:channelIds.map(id=>({id,name:components[id].name,selected:false,presentation:channelPresentation(null,{selected:false}),guide:setupGuide(id)})),releaseSelectionAvailable:Boolean(releasesDir),work:{known:false,pending:null,processing:null,uncertain:null},notice:'配置清单不可用。请先用 init 创建清单，并准备受保护的环境文件。'};}
  const plan=await prepareStatus(manifest),statuses=await inspectStatus(plan),map=new Map(statuses.map(item=>[item.channel,item]));
  let routerReachable=false;
  if(plan.router){try{const [tools,events]=await Promise.all([inspect(plan.router),inspect(plan.router,'events/list')]);routerReachable=tools.status===200&&events.status===200&&Array.isArray(tools.body?.result?.tools)&&Array.isArray(events.body?.result?.events);}catch{}}
  const channels=channelIds.map(id=>{const value=map.get(id)??{},selected=manifest.selected.includes(id);return {id,name:components[id].name,selected,...value,presentation:channelPresentation(value,{selected,mode:manifest.mode}),guide:setupGuide(id,value)};});
  return {demo:false,mode:manifest.mode,configurationAvailable:true,revision:revision(manifest),installation:releaseInfo(),routerReachable,updatedAt:new Date().toISOString(),channels,releaseSelectionAvailable:Boolean(releasesDir),work:workSummary(channels),notice:manifest.mode==='readiness'?'当前为预检模式，不连接真实聊天账号。':null};
}

function readBody(request){return new Promise((resolve,reject)=>{let length=0,overflow=false;const chunks=[];request.on('data',chunk=>{length+=chunk.length;if(length>8192){overflow=true;return;}chunks.push(chunk);});request.once('end',()=>{if(overflow)return reject(failure(413,'request_invalid','请求过大。'));try{const value=JSON.parse(Buffer.concat(chunks));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();resolve(value);}catch{reject(failure(400,'request_invalid','请求格式不正确。'));}});request.once('error',()=>reject(failure(400,'request_invalid','请求未完成。')));});}
function bodyFields(body,allowed){if(Object.keys(body).some(k=>!allowed.includes(k)))throw failure(400,'request_invalid','请求包含不适用的字段。');}
export async function startManagement({configFile,demo=false,port=5399,releasesDir,loadState,prepareCandidate=prepare}={}){
  assertNode();
  if(!Number.isInteger(port)||port<0||port>65535||(!demo&&typeof configFile!=='string'))throw failure(400,'request_invalid','请指定清单文件和有效的本机端口。');
  const token=randomBytes(32).toString('base64url');let origin,loading,mutating=false;
  const state=()=>loading??(loading=Promise.resolve().then(()=>loadState?loadState():demo?demoState():collectManagementState({configFile,releasesDir})).finally(()=>{loading=undefined;}));
  const server=http.createServer(async(request,response)=>{
    const headers={'Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",'X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin','Cross-Origin-Opener-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=(), clipboard-read=()'};
    const send=(status,value,type='application/json; charset=utf-8')=>{response.writeHead(status,{...headers,'Content-Type':type});response.end(type.startsWith('application/json')?JSON.stringify(value):value);};
    try{
      // A user may open the static landing page from an external link. Only
      // that top-level document navigation is allowed; APIs and embedded
      // cross-site requests retain the same origin and session protections.
      const landingNavigation=request.method==='GET'&&request.url==='/'&&request.headers['sec-fetch-mode']==='navigate'&&request.headers['sec-fetch-dest']==='document';
      if(request.headers.host!==new URL(origin).host||!['127.0.0.1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress)||(request.headers['sec-fetch-site']==='cross-site'&&!landingNavigation)||(request.headers.origin&&request.headers.origin!==origin))return send(403,{ok:false,error:'local_origin_required',message:'仅允许从本机管理页面访问。'});
      if(typeof request.url!=='string'||request.url.length>2048||request.url.includes('?'))return send(404,{ok:false,error:'not_found'});
      const route=request.url;
      if(request.method==='GET'&&assets.has(route)){const [file,type]=assets.get(route);return send(200,fs.readFileSync(new URL(file,import.meta.url)),type);}
      if(request.method==='GET'&&route==='/api/session')return send(200,{token});
      if(request.method==='GET'&&route==='/api/state')return send(200,await state());
      if(request.method==='GET'&&route==='/api/releases')return send(200,{releases:demo?[]:availableReleases(releasesDir)});
      if(request.method!=='POST'||!['/api/check-config','/api/save-config','/api/check-release','/api/upgrade-plan'].includes(route))return send(404,{ok:false,error:'not_found'});
      const supplied=request.headers['x-dotbridge-session'];
      if(request.headers.origin!==origin||typeof supplied!=='string'||supplied.length!==token.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token)))return send(403,{ok:false,error:'session_required',message:'请从管理页面重新发起操作。'});
      if(!/^application\/json(?:;\s*charset=utf-8)?$/iu.test(request.headers['content-type']??''))return send(415,{ok:false,error:'json_required'});
      if(demo)throw failure(409,'demo_read_only','演示模式不保存配置，也不执行升级。');
      const body=await readBody(request),current=readManifest(configFile);
      if(route==='/api/check-config'||route==='/api/save-config'){
        bodyFields(body,route==='/api/check-config'?['channels']:['channels','revision','confirm']);
        const candidate=candidateManifest(current,body.channels);
        await prepareCandidate(candidate);
        if(route==='/api/check-config')return send(200,{ok:true,configurationReady:true,channels:candidate.selected,providerNetworkChecked:false});
        if(body.confirm!==true)throw failure(400,'confirmation_required','请先确认只保存下次启动配置。');
        if(mutating)throw failure(409,'configuration_changed','另一个配置保存正在进行，请稍后刷新。');
        mutating=true;try{return send(200,{ok:true,...writeManifest(current,candidate,body.revision)});}finally{mutating=false;}
      }
      bodyFields(body,['release']);
      const verified=verifyRelease(releasesDir,body.release,current),snapshot=await state();
      let offlineReady=false;try{await prepareCandidate(current);offlineReady=true;}catch{}
      const work=snapshot.work??{known:false,pending:null,processing:null,uncertain:null};
      const result={...verified,compatibility:{...verified.compatibility,currentOfflineConfigurationReady:offlineReady},work,
        blockers:[...(!offlineReady?['current_configuration_incomplete']:[]),...(!work.known?['reply_work_unknown']:[]),...(work.known&&(work.pending||work.processing||work.uncertain)?['reply_work_unresolved']:[]),'release_source_review_required','consistent_backup_required','rollback_compatibility_review_required','target_doctor_required','administrator_cutover_required'],
        rollbackChecks:{replyWorkClear:work.known?work.pending===0&&work.processing===0&&work.uncertain===0:null,databaseBackupVerified:null,targetSchemaCompatibilityVerified:null,qqMediaHistoryCompatible:null},upgraded:false};
      if(route==='/api/check-release')return send(200,{ok:true,...result});
      response.setHeader('Content-Disposition','attachment; filename="dotbridge-upgrade-plan.txt"');
      return send(200,upgradeRunbook(result,current,work),'text/plain; charset=utf-8');
    }catch(error){send(error instanceof ManagementError?error.status:400,safeError(error));}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=3000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;
  let finish;const closed=new Promise(resolve=>{finish=resolve;});server.once('close',()=>finish());
  return {url:origin,closed,close:()=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();})};
}
