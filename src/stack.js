import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {processEnvironment} from './config.js';
import {inspectMcp} from './rpc.js';
import {OperatorError,refuse} from './errors.js';

const entry=fileURLToPath(new URL('./entry.js',import.meta.url));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function assertFree(endpoint) {
  const server=net.createServer();
  await new Promise((resolve,reject)=>{
    server.once('error',()=>reject(new OperatorError('port_busy','配置端口已被占用，请检查是否已有桥接实例。')));
    server.listen({host:endpoint.host,port:endpoint.port,exclusive:true},()=>server.close(resolve));
  });
}
export async function startStack(plan,{confirmLive=false,onEvent=()=>{},startupMs=30000,graceMs=180000,signal}={}) {
  if((plan.manifest.mode==='live')!==confirmLive)refuse('live_confirmation','正式收发需要明确提供 --confirm-live。');
  for(const endpoint of [...Object.values(plan.backends),plan.router]){await assertFree(endpoint);if(endpoint.config.webhookPort)await assertFree({host:endpoint.host,port:endpoint.config.webhookPort});}
  const children=[];let stopping=false,closePromise,failure=null,finish;
  const closed=new Promise(resolve=>{finish=resolve;});
  const close=()=>{
    if(closePromise)return closePromise;stopping=true;
    closePromise=(async()=>{
      for(const item of [...children].reverse()){
        if(!item.exited){try{item.child.stdin.end('stop\n');}catch{}}
        let timer;
        await Promise.race([item.done,new Promise(resolve=>{timer=setTimeout(()=>{failure??='shutdown_timeout';item.child.kill('SIGKILL');resolve();},graceMs);})]);
        clearTimeout(timer);
        // SIGKILL is a final fallback after the normal grace period; collect exit.
        if(!item.exited)await item.done;
      }
      const result={code:failure?1:0,...(failure?{reason:failure}:{})};
      signal?.removeEventListener('abort',abort);onEvent({event:'stack_stopped',...result});finish(result);return result;
    })();
    return closePromise;
  };
  const abort=()=>{void close();};
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  const begin=id=>{
    const args=[entry,'--config',plan.manifest.file,'--component',id,'--supervised',...(confirmLive?['--confirm-live']:[])];
    const child=spawn(process.execPath,args,{env:processEnvironment(),stdio:['pipe','pipe','pipe'],windowsHide:true});
    let ended;const item={id,child,exited:false,done:new Promise(resolve=>{ended=resolve;})};children.push(item);
    child.stdin.on('error',()=>{});
    // Backend diagnostics may contain vendor-generated text. The operator view
    // reports bounded lifecycle state; systemd retains the component's own logs.
    child.stdout.on('data',bytes=>bytes.fill(0));child.stderr.on('data',bytes=>bytes.fill(0));
    child.once('error',()=>{failure??='component_start_failed';void close();});
    child.once('close',code=>{item.exited=true;ended();if(!stopping){failure??='component_exited';onEvent({event:'component_exited',component:id,code});void close();}});
    return item;
  };
  const waitReady=async(item,endpoint)=>{
    const until=Date.now()+startupMs;
    while(Date.now()<until){
      if(stopping||item.exited)throw new OperatorError('component_exited','组件在启动期间退出，已停止本次启动的组件。');
      try{
        const result=await inspectMcp(endpoint,'tools/list',{timeout:1000});
        if(result.status===200&&Array.isArray(result.body?.result?.tools))return result.body.result.tools.length;
      }catch{}
      await pause(150);
    }
    throw new OperatorError('startup_timeout','组件未在启动期限内完成本地认证检查。');
  };
  try {
    for(const id of plan.manifest.selected){if(stopping)throw Error();const item=begin(id);await waitReady(item,plan.backends[id]);onEvent({event:'component_ready',component:id});}
    if(stopping)throw Error();
    const router=begin('router'),toolCount=await waitReady(router,plan.router);
    onEvent({event:'stack_ready',mode:plan.manifest.mode,channels:plan.manifest.selected,toolCount});
    return {close,closed,pids:()=>Object.fromEntries(children.map(item=>[item.id,item.child.pid]))};
  }catch(error){failure??=error?.code??'startup_failed';await close();throw error instanceof OperatorError?error:new OperatorError('startup_failed','启动未完成，本次创建的组件已停止。');}
}
