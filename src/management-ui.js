const $=id=>document.getElementById(id);
const titles={overview:'渠道总览',setup:'接入引导',settings:'运行设置',updates:'版本与升级',reminders:'我的提醒'};
const symbols={lark:'飞',qq:'QQ',dingtalk:'钉',wecom:'企',weixin:'微',discord:'D',telegram:'T',line:'L'};
const english={lark:'FEISHU / LARK',qq:'QQ OFFICIAL BOT',dingtalk:'DINGTALK',wecom:'WECOM',weixin:'WEIXIN ILINK',discord:'DISCORD',telegram:'TELEGRAM',line:'LINE'};
let session,snapshot,selectedRelease;
let reminderOffset=0;
let nextReminderOffset=null;
let editingReminder=null;
let reminderSendEnabled=false;
let reminderIntent=crypto.randomUUID();
const reminderStates={active:'等待下次提醒',pending:'等待发送',paused:'已暂停',sending:'正在发送',sent:'已发送',completed:'已结束',cancelled:'已取消',expired:'已错过',uncertain:'结果待核对',rejected:'平台拒绝'};
const reminderReasons={provider_permission_denied:'平台权限不足',provider_quota_exhausted:'平台额度不足',provider_rejected:'平台明确拒绝',provider_result_unknown:'发送结果待人工核对',recovered_inflight:'重启前的发送结果待核对',missed:'服务恢复时已超过补发时间'};
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const replace=(element,children)=>element.replaceChildren(...children);
function feedback(text,error=false){$('feedback').textContent=text;$('feedback').className='feedback'+(error?' error':'');}
function view(id){for(const key of Object.keys(titles))$('view-'+key).classList.toggle('hidden',key!==id);for(const button of document.querySelectorAll('.nav')){button.classList.toggle('active',button.dataset.view===id);if(button.dataset.view===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}$('breadcrumb').textContent='工作台 / '+titles[id];if(id==='setup')renderSetup();if(id==='reminders')void loadReminders().catch(error=>feedback(error.message,true));if(id==='updates')void releases().catch(()=>feedback('发行目录暂时不可用，请核对启动参数。',true));}
async function api(url,body){const response=await fetch(url,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json','X-DotBridge-Session':session}:{},...(body?{body:JSON.stringify(body)}:{})});const result=await response.json();if(!response.ok)throw Error(result.message??'操作未完成，请刷新后检查。');return result;}
async function busy(button,action){button.disabled=true;try{await action();}catch(error){feedback(error.message,true);}finally{button.disabled=button.id==='reminder-save'&&!reminderSendEnabled;}}
function summaryCard(label,value,unit,icon){const card=node('div','summary-card'),text=node('div');text.append(node('p',null,label));const strong=node('strong',null,String(value));strong.append(node('small',null,unit));text.append(strong);card.append(text,node('span','summary-icon',icon));return card;}
function renderState(value){
  snapshot=value;$('sidebar-version').textContent='DotBridge '+value.installation.version;$('current-version').textContent='v'+value.installation.version;
  $('notice').classList.toggle('hidden',!value.notice);$('notice').textContent=value.notice??'';
  const selected=value.channels.filter(c=>c.selected),ready=selected.filter(c=>c.presentation.state==='ready').length,attention=selected.filter(c=>!['ready','readiness'].includes(c.presentation.state)).length;
  replace($('summary'),[summaryCard('已选渠道',selected.length,'/ 8 个渠道','◈'),summaryCard('链路就绪',ready,'个入口','✓'),summaryCard('需要处理',attention,'项连接进度','↗')]);
  $('updated').textContent='最近检查 '+new Date(value.updatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})+' · '+(value.routerReachable?'聚合入口可访问':value.routerReachable===false?'聚合入口未连接':'等待配置');
  replace($('channels'),value.channels.map(c=>{const card=node('article','channel-card'),main=node('div','channel-main'),title=node('div','channel-title'),names=node('div');names.append(node('h3',null,c.name),node('span','sub',english[c.id]));title.append(node('span','channel-symbol',symbols[c.id]),names);main.append(title,node('span','badge '+c.presentation.tone,c.presentation.label),node('p','channel-detail',c.presentation.detail));const foot=node('div','channel-footer');foot.append(node('span',null,c.selected?'原会话回复':'按需接入'));const button=node('button',null,c.selected?'查看连接 →':'开始接入 →');button.addEventListener('click',()=>{$('setup-channel').value=c.id;view('setup');});foot.append(button);card.append(main,foot);return card;}));
  const previous=$('setup-channel').value;replace($('setup-channel'),value.channels.map(c=>{const option=node('option',null,c.name);option.value=c.id;return option;}));if(value.channels.some(c=>c.id===previous))$('setup-channel').value=previous;
  replace($('channel-options'),value.channels.map(c=>{const label=node('label','option'),input=node('input');input.type='checkbox';input.value=c.id;input.checked=c.selected;input.disabled=value.demo||!value.configurationAvailable;label.append(input,node('span',null,c.name));return label;}));
  for(const id of ['check-config','save-config'])$(id).disabled=value.demo||!value.configurationAvailable;
  replace($('component-versions'),value.installation.components.map(c=>{const item=node('div','component-item');item.append(node('span',null,c.id==='core'?'共享核心':value.channels.find(x=>x.id===c.id)?.name??c.id),node('strong',null,c.version));return item;}));
  renderReminderChannels(value);
  renderSetup();
}
function setupStep(number,title,children){const row=node('div','step'),content=node('div');content.append(node('h3',null,title),...children);row.append(node('span','step-number',String(number)),content);return row;}
function renderSetup(){
  if(!snapshot)return;const channel=snapshot.channels.find(c=>c.id===$('setup-channel').value)??snapshot.channels[0],guide=channel.guide,panel=node('div','panel');
  const platform=[node('p',null,'所需私密信息：'+guide.credentials.join('、')+'。只保存在受保护的文件中。')];if(guide.console){const link=node('a',null,'打开官方管理入口 ↗');link.href=guide.console;link.target='_blank';link.rel='noreferrer noopener';platform.push(link);}const list=node('ul');for(const text of guide.steps)list.append(node('li',null,text));platform.push(list);
  const pair=[node('p',null,guide.pairingNotice)];if(guide.binding===true)pair.push(node('span','badge good','已保留本人绑定'));else{const advanced=node('details');advanced.append(node('summary',null,'首次配对：确认尚无绑定后在终端操作'));for(const command of guide.commands)advanced.append(node('pre',null,command));advanced.append(node('p',null,'命令中的占位符需要换成已核验的私有文件路径。页面不接收 Token、身份值或配对口令。'));pair.push(advanced);}
  if(channel.id==='qq'&&guide.binding!==true)pair.push(node('p',null,'先查看扫码计划并确认授权，再由本人扫描原机器人。若 QQ 页面要求新建或替换应用，请取消并先确认。确认参数用于记录已获得的许可。'));
  if(channel.id==='line')platform.push(node('p',null,'LINE 回复图片或语音时，会先拿一个临时下载地址，再去取内容。需要准备这种下载入口后才能开启媒体回复；可以使用现有域名，不必另买服务器。当前页面不会开放这个入口。'));
  if(channel.mediaReadiness?.replyPublisherRequired)platform.push(node('span','badge '+(channel.mediaReadiness.replyPublisherConfigured?'good':'quiet'),channel.mediaReadiness.replyPublisherConfigured?'临时下载入口已配置':'图片与语音回复尚待配置'));
  const subscribed=channel.subscriptionActive===true;const subscribe=[node('p',null,subscribed?'原 dot 已有有效订阅。继续沿用，不重复创建。':'在原 dot 刷新现有 Tunnel 目录后，把下面这段话发给它。失败时先查看下方诊断，再处理原因。')];if(!subscribed)subscribe.push(node('pre',null,guide.subscriptionPrompt));
  if(channel.subscriptionStatus?.expiresAt)subscribe.push(node('p',null,'有效期至 '+new Date(channel.subscriptionStatus.expiresAt).toLocaleString('zh-CN')+'，由原 dot 续订。'));
  if(!subscribed){const copy=node('button','button secondary','复制给原 dot 的话');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(guide.subscriptionPrompt);feedback('已复制，可发给原来的 dot。');}catch{feedback('浏览器未允许复制，请手动选择上面的文字。',true);}});subscribe.push(copy);}
  if(channel.subscriptionDiagnostics?.length){const descriptions={validate:'订阅请求格式未通过检查',policy:'回调域名需要核对批准',transport:'暂时无法连接 dot 的通知入口',challenge:'dot 的回调验证未完成',persist:'订阅尚未保存',complete:'订阅已保存'};const latest=channel.subscriptionDiagnostics.at(-1);subscribe.push(node('p',null,'最近一次记录：'+descriptions[latest.stage]+'。'));const advanced=node('details');advanced.append(node('summary',null,'查看脱敏诊断'));for(const item of channel.subscriptionDiagnostics){const row=node('div','diagnostic');for(const text of [item.stage,item.code??'—',item.reason,item.hostname??'无域名'])row.append(node('span',null,String(text)));advanced.append(row);}subscribe.push(advanced);}else subscribe.push(node('p',null,'暂无可用的订阅请求记录，无法据此还原之前失败。'));
  if(channel.connectionStatus?.callbackSettingName){const policy=node('details');policy.append(node('summary',null,'查看通知域名配置'));policy.append(node('p',null,'本渠道读取的配置项：'+channel.connectionStatus.callbackSettingName));if(channel.connectionStatus.callbackHostCount!==null)policy.append(node('p',null,'已设置精确域名数量：'+channel.connectionStatus.callbackHostCount));if(channel.connectionStatus.wrongCallbackSettingPresent===true)policy.append(node('p',null,'检测到另一种配置名；该名称对本渠道不生效，请管理员核对。页面不会替你更改或批准域名。'));subscribe.push(policy);}
  const check=[node('span','badge '+channel.presentation.tone,channel.presentation.label),node('p',null,channel.presentation.detail),node('p',null,'订阅就绪后，从本人私聊发送两条不同消息，确认各回复一次。平台连接、服务存活和真实收发分别核对。')];
  if(channel.replyCapabilities?.longReplyMode==='file')check.push(node('p',null,'较长的回答会作为文本文件发回，保留完整内容。'));
  if(channel.replyCapabilities?.longReplyMode==='chunks')check.push(node('p',null,'较长的回答会在同一次回复中分段显示。'));
  const reminders=node('details');reminders.append(node('summary',null,'让 dot 定时给我发消息'),node('p',null,'主动发送需管理员按渠道单独开启。固定文字提醒保存在服务器；动态内容由原 dot 保存定时任务。每个渠道的可用情况可在“我的提醒”中查看。'),node('pre',null,guide.outboundPrompt));
  panel.append(setupStep(1,'准备平台应用',platform),setupStep(2,guide.binding===true?'本人绑定已存在':guide.binding===false?'在私密终端完成本人配对':'核对已有本人绑定',pair),setupStep(3,'连接原 dot 的事件订阅',subscribe),setupStep(4,'刷新状态并确认回复',check),reminders);replace($('setup-content'),[panel]);
}
async function refresh(){renderState(await api('/api/state'));}
function choices(){return [...document.querySelectorAll('#channel-options input:checked')].map(i=>i.value);}
async function releases(){
  if(!snapshot)return;const result=await api('/api/releases');replace($('release-choice'),result.releases.map(r=>{const option=node('option',null,r.id+' · v'+r.version);option.value=r.id;return option;}));const empty=!result.releases.length;$('check-release').disabled=empty;$('release-choice').disabled=empty;$('release-empty').textContent=empty?(snapshot.demo?'演示模式不读取本机发行目录。':'未发现可检查的发行版。启动时用 --releases-dir 指定已下载、已审核的发行目录父目录。'):'校验清单、锁文件和包哈希；来源审核、数据库备份和服务切换仍由管理员完成。';
}
function renderRelease(result){
  selectedRelease=result.id;const elements=[node('span','badge good','安装包与清单一致'),node('p','help','目标版本 v'+result.version+' · 尚未安装或切换')],table=node('table','release-diff'),head=node('tr');for(const text of ['组件','当前','目标'])head.append(node('th',null,text));table.append(head);for(const item of result.components){const row=node('tr');for(const text of [item.id,item.currentVersion??'未安装',item.version+(item.changed?' · 将更新':'')])row.append(node('td',null,text));table.append(row);}elements.push(table);
  const checks=node('ul','check-list'),compat=result.compatibility;for(const [label,okay] of [['清单格式',compat.manifestSchemaSupported],['所选渠道已包含',compat.selectedChannelsAvailable],['当前 Node 版本',compat.nodeVersionCompatible],['当前私有配置离线检查',compat.currentOfflineConfigurationReady]])checks.append(node('li',null,(okay?'✓ ':'待处理 · ')+label));
  checks.append(node('li',null,result.work.known?`完整回复队列：等待 ${result.work.pending}，处理中 ${result.work.processing}，结果不明 ${result.work.uncertain}`:'完整回复队列：当前未知，需在最终运行主机核对。'));
  checks.append(node('li',null,'待管理员：确认发行版来源、处理未完成任务、完成一致性备份、运行目标版本 doctor，再安排停机切换。'));elements.push(checks);replace($('release-result'),elements);$('download-plan').classList.remove('hidden');
}
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>view(button.dataset.view));
$('setup-channel').addEventListener('change',renderSetup);
$('refresh').addEventListener('click',()=>void busy($('refresh'),refresh));
$('check-config').addEventListener('click',()=>void busy($('check-config'),async()=>{await api('/api/check-config',{channels:choices()});feedback('所选配置通过离线检查。尚未连接平台、启动服务或保存更改。');}));
$('save-config').addEventListener('click',()=>{$('confirm-dialog').showModal();});
$('confirm-dialog').addEventListener('close',()=>{if($('confirm-dialog').returnValue!=='confirm')return;void busy($('save-config'),async()=>{await api('/api/save-config',{channels:choices(),revision:snapshot.revision,confirm:true});feedback('已保存，并保留原清单备份。当前服务未重启，新选择将在管理员重启后生效。');await refresh();});});
$('check-release').addEventListener('click',()=>void busy($('check-release'),async()=>renderRelease(await api('/api/check-release',{release:$('release-choice').value}))));
$('download-plan').addEventListener('click',()=>void busy($('download-plan'),async()=>{const response=await fetch('/api/upgrade-plan',{method:'POST',headers:{'Content-Type':'application/json','X-DotBridge-Session':session},body:JSON.stringify({release:selectedRelease})});if(!response.ok){const result=await response.json();throw Error(result.message??'操作单生成失败。');}const blob=await response.blob(),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='dotbridge-upgrade-plan.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('操作单已生成。请由管理员按实际主机情况完成备份和切换。');}));
try{session=(await api('/api/session')).token;await refresh();}catch{feedback('管理页面暂时无法读取状态。请确认本机管理进程仍在运行，然后刷新页面。',true);}


function renderReminderChannels(value){
  const previous=$('reminder-channel').value;
  replace($('reminder-channel'),value.channels.filter(channel=>channel.selected).map(channel=>{
    const option=node('option',null,channel.name);option.value=channel.id;return option;
  }));
  if([...$('reminder-channel').options].some(option=>option.value===previous))$('reminder-channel').value=previous;
  $('reminder-timezone').value ||= Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function reminderTime(value,timezone){
  try{return new Intl.DateTimeFormat('zh-CN',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
  catch{return value;}
}
function reminderLocalInput(value,timezone){
  const values=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
function updateReminderRepeat(){
  const repeat=$('reminder-repeat').value;
  $('reminder-interval-label').classList.toggle('hidden',repeat!=='interval');
  $('reminder-until-label').classList.toggle('hidden',repeat==='once');
  $('reminder-until').required=repeat!=='once';
}
function resetReminderForm(){
  editingReminder=null;
  reminderIntent=crypto.randomUUID();
  $('reminder-form').reset();
  $('reminder-timezone').value=Intl.DateTimeFormat().resolvedOptions().timeZone;
  $('reminder-form-title').textContent='新建提醒';
  $('reminder-paused-label').classList.remove('hidden');
  updateReminderRepeat();
}
function editReminder(reminder){
  editingReminder=reminder;
  $('reminder-form-title').textContent=reminder.status==='paused'?'编辑已暂停的提醒':'编辑提醒';
  $('reminder-text').value=reminder.text;
  $('reminder-timezone').value=reminder.timezone;
  $('reminder-time').value=reminderLocalInput(reminder.send_at,reminder.timezone);
  $('reminder-repeat').value=reminder.repeat;
  $('reminder-until').value=reminder.until?reminderLocalInput(reminder.until,reminder.timezone):'';
  $('reminder-interval').value=reminder.interval_minutes??60;
  $('reminder-paused-label').classList.add('hidden');
  updateReminderRepeat();
  $('reminder-text').focus();
}
async function reminderAction(reminder,action){
  if(action==='cancel'&&!window.confirm('取消这条提醒及其后续发送？已开始的发送会保留原状态。'))return;
  await api('/api/reminder-action',{channel:$('reminder-channel').value,outbound_id:reminder.outbound_id,expected_revision:reminder.revision,action,confirm:true});
  feedback(action==='pause'?'提醒已暂停。':action==='resume'?'提醒已恢复。':'提醒已取消。');
  await loadReminders();
}
async function reminderHistory(reminder){
  const result=await api('/api/reminder-history',{channel:$('reminder-channel').value,outbound_id:reminder.outbound_id});
  const panel=$('reminder-history');panel.classList.remove('hidden');
  replace(panel,[node('h2',null,'最近发送记录')]);
  if(!result.attempts.length)panel.append(node('p','muted','这条提醒尚无发送记录。'));
  for(const attempt of result.attempts)panel.append(node('p',null,reminderTime(attempt.scheduled_at,reminder.timezone)+' · '+(reminderStates[attempt.status]??attempt.status)+(reminderReasons[attempt.reason]?' · '+reminderReasons[attempt.reason]:'')));
}
async function loadReminders(){
  if(!snapshot)return;
  const channel=$('reminder-channel').value;
  if(snapshot.demo||snapshot.mode!=='live'||!channel){
    reminderSendEnabled=false;
    $('reminder-availability').textContent=snapshot.demo?'演示页面仅展示操作入口。':snapshot.mode!=='live'?'当前为预检模式，完成真实接入后可管理提醒。':'请先接入一个渠道。';
    $('reminder-save').disabled=true;
    return;
  }
  const result=await api('/api/reminders',{channel,offset:reminderOffset,include_finished:$('reminder-finished').checked});
  if(channel!==$('reminder-channel').value)return;
  reminderSendEnabled=result.outbound.enabled===true;
  $('reminder-save').disabled=!reminderSendEnabled;
  $('reminder-availability').textContent=reminderSendEnabled?'发送到此渠道已绑定的本人私聊。重复提醒按所选时区执行。':'此渠道的主动发送尚未启用。已有提醒仍可查看、暂停或取消。';
  nextReminderOffset=result.next_offset??null;
  $('reminder-previous').disabled=reminderOffset===0;
  $('reminder-next').disabled=nextReminderOffset===null;
  const cards=result.messages.map(reminder=>{
    const card=node('article','panel reminder-card');
    card.append(node('strong',null,reminderStates[reminder.status]??reminder.status),node('p','reminder-content',reminder.text||'正文已按保留规则清理'),node('p','muted','计划时间 '+reminderTime(reminder.send_at,reminder.timezone)+' · '+reminder.timezone));
    const repeats={once:'仅一次',daily:'每天',weekly:'每周',weekdays:'周一至周五',interval:'每 '+reminder.interval_minutes+' 分钟'};
    card.append(node('p','muted',repeats[reminder.repeat]+(reminder.until?' · 结束于 '+reminderTime(reminder.until,reminder.timezone):'')));
    if(reminderReasons[reminder.reason])card.append(node('p','help',reminderReasons[reminder.reason]));
    const actions=node('div','settings-actions');
    const button=(text,action)=>{const control=node('button','button secondary',text);control.type='button';control.addEventListener('click',()=>busy(control,action));actions.append(control);};
    if(['active','paused'].includes(reminder.status)&&reminderSendEnabled)button('编辑',()=>editReminder(reminder));
    if(['active','pending'].includes(reminder.status))button('暂停',()=>reminderAction(reminder,'pause'));
    if(reminder.status==='paused'&&reminderSendEnabled)button('恢复',()=>reminderAction(reminder,'resume'));
    if(['active','pending','paused','uncertain','rejected'].includes(reminder.status))button('取消',()=>reminderAction(reminder,'cancel'));
    button('发送记录',()=>reminderHistory(reminder));
    card.append(actions);return card;
  });
  replace($('reminder-list'),cards.length?cards:[node('p','panel muted','当前没有此类提醒。')]);
}

$('reminder-repeat').addEventListener('change',updateReminderRepeat);
$('reminder-reset').addEventListener('click',resetReminderForm);
$('reminder-refresh').addEventListener('click',()=>busy($('reminder-refresh'),loadReminders));
for(const id of ['reminder-channel','reminder-finished'])$(id).addEventListener('change',()=>{reminderOffset=0;resetReminderForm();void loadReminders().catch(error=>feedback(error.message,true));});
$('reminder-previous').addEventListener('click',()=>{reminderOffset=Math.max(0,reminderOffset-20);void loadReminders().catch(error=>feedback(error.message,true));});
$('reminder-next').addEventListener('click',()=>{if(nextReminderOffset!==null){reminderOffset=nextReminderOffset;void loadReminders().catch(error=>feedback(error.message,true));}});
$('reminder-form').addEventListener('submit',event=>{
  event.preventDefault();
  void busy($('reminder-save'),async()=>{
    const repeat=$('reminder-repeat').value;
    const body={channel:$('reminder-channel').value,text:$('reminder-text').value,local_time:$('reminder-time').value,timezone:$('reminder-timezone').value,repeat,until_local:repeat==='once'?null:$('reminder-until').value,confirm:true};
    if(repeat==='interval')body.interval_minutes=Number($('reminder-interval').value);
    if(editingReminder){body.outbound_id=editingReminder.outbound_id;body.expected_revision=editingReminder.revision;}
    else{body.idempotency_key=reminderIntent;body.paused=$('reminder-paused').checked;}
    const result=await api('/api/reminder-save',body);
    feedback(result.status==='paused'?'提醒已保存为暂停。':'提醒已保存，计划时间 '+reminderTime(result.send_at,result.timezone)+'。');
    resetReminderForm();await loadReminders();
  });
});
