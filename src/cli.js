import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {parseArgs} from 'node:util';
import {channelIds,components} from './components.js';
import {assertNode,readManifest,prepare} from './config.js';
import {startStack} from './stack.js';
import {inspectMcp} from './rpc.js';
import {writeUnits,serviceAction} from './systemd.js';
import {OperatorError,refuse} from './errors.js';

const help=`DotBridge — 将聊天软件接回同一个 dot\n\n使用方式：dotbridge <命令> [选项]\n  channels                         查看当前提供的 IM\n  init --config <文件>              创建不含凭据的配置清单\n    --channels lark,qq              选择启用的渠道\n    --env-dir <绝对目录>            已有私有环境文件所在目录\n    --data-dir <绝对目录>           持久数据目录\n    --mode readiness|live          默认 readiness\n  doctor --config <文件>            离线检查组件和私有配置\n  status --config <文件>            检查本地 MCP 目录与认证\n  run --config <文件>               前台运行选中的组件\n    --confirm-live                 正式收发时必须明确提供\n  service render --config <文件> --output <新目录>\n  service start|stop|restart|status --config <文件>\n\nrun 通过 Ctrl+C 优雅停止。Linux 常驻运行使用生成的 systemd 服务。\n`;
const write=value=>process.stdout.write(JSON.stringify(value,null,2)+'\n');
const options=args=>parseArgs({args,strict:true,options:{config:{type:'string'},channels:{type:'string'},'env-dir':{type:'string'},'data-dir':{type:'string'},mode:{type:'string'},output:{type:'string'},'confirm-live':{type:'boolean'}}}).values;
function init(value) {
  const file=path.resolve(value.config??'bridge.json');
  const selected=(value.channels??'lark,qq').split(',');
  if(!selected.length||selected.some(id=>!channelIds.includes(id))||new Set(selected).size!==selected.length)refuse('channels_invalid','请选择 channels 命令列出的渠道，且不能重复。');
  const dataDirectory=path.resolve(value['data-dir']??(process.platform==='linux'?'/var/lib/dot-bridge':path.join(os.homedir(),'.dot-bridge')));
  const envDirectory=path.resolve(value['env-dir']??path.join(dataDirectory,'private'));
  const mode=value.mode??'readiness';if(!['readiness','live'].includes(mode))refuse('mode_invalid','mode 必须是 readiness 或 live。');
  const parent=path.dirname(file);
  if(!fs.existsSync(parent)||fs.realpathSync(parent).toLowerCase()!==parent.toLowerCase())refuse('directory_unavailable','请先创建配置目录，并使用真实路径。');
  const content={version:1,mode,channels:Object.fromEntries(selected.map(id=>[id,path.join(envDirectory,id==='qq'&&mode==='live'?'qq-live.env':`${id}.env`)])),routerEnv:path.join(envDirectory,'router.env'),dataDirectory,systemd:{prefix:'dot-bridge',user:'dot-bridge'}};
  try{fs.writeFileSync(file,JSON.stringify(content,null,2)+'\n',{flag:'wx',mode:0o600});}
  catch{refuse('manifest_exists','配置文件未创建；目标可能已存在，请保留原文件或换一个路径。');}
  write({created:file,channels:selected,mode,credentialsCreated:false,next:'按接入文档准备所选渠道的受保护环境文件，然后运行 doctor。'});
}
export async function main(args=process.argv.slice(2)) {
  try {
    assertNode();const command=args[0]??'help';
    if(['help','--help','-h'].includes(command)){process.stdout.write(help);return;}
    if(command==='channels'){
      if(args.length!==1)refuse('arguments_invalid','channels 不接受其他参数。');
      write(channelIds.map(id=>({id,name:components[id].name,available:true})));return;
    }
    const action=command==='service'?args[1]:null;
    const value=options(args.slice(command==='service'?2:1));
    const allowed=command==='init'?['config','channels','env-dir','data-dir','mode']:
      command==='run'?['config','confirm-live']:
      command==='service'&&action==='render'?['config','output']:
      command==='service'&&['start','restart'].includes(action)?['config','confirm-live']:['config'];
    if(Object.keys(value).some(key=>!allowed.includes(key)))refuse('arguments_invalid','该命令包含不适用的选项；启用的渠道由配置清单决定。');
    if(command==='init'){init(value);return;}
    if(!value.config)refuse('config_required','请使用 --config 指定配置清单。');
    const manifest=readManifest(value.config);
    if(command==='service'){
      if(action==='render'){
        if(!value.output)refuse('output_required','请提供 --output 服务文件输出目录。');
        write({files:writeUnits(manifest,value.output),installed:false,next:'由管理员核对文件、数据目录和运行用户，再安装到 systemd。'});
      }else{
        if(manifest.mode==='live'&&['start','restart'].includes(action)&&!value['confirm-live'])refuse('live_confirmation','正式服务启动或重启需要 --confirm-live。');
        process.stdout.write(serviceAction(manifest,action)+'\n');
      }
      return;
    }
    if(!['doctor','status','run'].includes(command))refuse('command_unknown','未知命令，请运行 dotbridge help。');
    if(command==='run'&&(manifest.mode==='live')!==Boolean(value['confirm-live']))refuse('live_confirmation','正式收发需要 --confirm-live；readiness 不接受该标志。');
    const plan=await prepare(manifest);
    if(command==='doctor'){write({configurationReady:true,mode:manifest.mode,channels:manifest.selected,providerNetworkChecked:false});return;}
    if(command==='status'){
      const tools=await inspectMcp(plan.router),events=await inspectMcp(plan.router,'events/list');
      const reachable=tools.status===200&&events.status===200&&Array.isArray(tools.body?.result?.tools)&&Array.isArray(events.body?.result?.events);
      write({authenticatedMcpReachable:reachable,mode:manifest.mode,channels:manifest.selected,toolCount:reachable?tools.body.result.tools.length:0,eventCount:reachable?events.body.result.events.length:0,providerDeliveryChecked:false});if(!reachable)process.exitCode=1;return;
    }
    let stack,stopRequested=false;const controller=new AbortController();
    const stop=()=>{stopRequested=true;controller.abort();void stack?.close();};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    try {
      stack=await startStack(plan,{confirmLive:Boolean(value['confirm-live']),onEvent:write,signal:controller.signal});
      if(stopRequested)await stack.close();
      process.exitCode=(await stack.closed).code;
    } finally {process.off('SIGINT',stop);process.off('SIGTERM',stop);}
  }catch(error){
    write({ok:false,error:error instanceof OperatorError?error.code:'operation_failed',message:error instanceof OperatorError?error.message:'操作未完成，请检查命令参数、配置和组件安装；未输出私有值。'});process.exitCode=1;
  }
}
