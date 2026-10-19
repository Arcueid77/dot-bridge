import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {privateMkdtempSync,fixtureChmodSync,cleanupPrivateFixture,privateMkdirSync} from '@dot-bridge/core/platform/test-fixtures.js';
import {readManifest} from '../src/config.js';
export async function fixture(t,selected=['lark','qq']) {
 const directory=privateMkdtempSync(path.join(os.tmpdir(),'dot-distribution-'));fixtureChmodSync(directory,0o700);cleanupPrivateFixture(t,directory);
 const servers=await Promise.all(Array.from({length:3},()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>resolve(s));})));
 const ports=servers.map(s=>s.address().port);await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));
 const write=(name,text)=>{const file=path.join(directory,name);fs.writeFileSync(file,text,{mode:0o600});fixtureChmodSync(file,0o600);return file;};
 const keys=['lark','qq','router'].map((id,index)=>write(`${id}.key`,Buffer.alloc(32,index+51).toString('base64url')));
 const env={};
 for(const [index,id] of ['lark','qq'].entries())env[id]=write(`${id}.env`,[
  'AUTH_MODE=tunnel-service','BRIDGE_MODE=tunnel','TUNNEL_SERVICE_OPERATION=readiness','TUNNEL_SERVICE_OWNER_ID=tunnel-owner:dot-bridge','HOST=127.0.0.1',`PORT=${ports[index]}`,`TUNNEL_SERVICE_KEY_FILE=${keys[index]}`,`${id==='lark'?'LARK':'QQ'}_TRANSPORT=disabled`
 ].join('\n')+'\n');
 env.router=write('router.env',['AUTH_MODE=tunnel-service','BRIDGE_MODE=tunnel','TUNNEL_SERVICE_OPERATION=readiness','HOST=127.0.0.1',`PORT=${ports[2]}`,`TUNNEL_SERVICE_KEY_FILE=${keys[2]}`].join('\n')+'\n');
 const dataDirectory=path.join(directory,'data');privateMkdirSync(dataDirectory,{mode:0o700});
 for(const sub of [...selected,'locks'])privateMkdirSync(path.join(dataDirectory,sub),{mode:0o700});
 const config={version:1,mode:'readiness',channels:Object.fromEntries(selected.map(id=>[id,env[id]])),routerEnv:env.router,dataDirectory,systemd:{prefix:'dot-bridge-test',user:process.platform==='linux'&&os.userInfo().username!=='root'?os.userInfo().username:'dot-bridge'}};
 const file=write('bridge.json',JSON.stringify(config));
 return {directory,keys,ports,env,config,file,write,manifest:()=>readManifest(file)};
}
