import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {beforeFixtureCleanup,privateMkdirSync} from '@dot-bridge/core/platform/test-fixtures.js';
import {fixture} from './fixture.js';
import {readManifest,prepare,readEnvironment} from '../src/config.js';
import {startStack} from '../src/stack.js';
import {inspectMcp} from '../src/rpc.js';
import {renderUnits} from '../src/systemd.js';
import {components} from '../src/components.js';

const cli=fileURLToPath(new URL('../bin/dotbridge.js',import.meta.url));
const closedPort=port=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(false);});socket.once('error',()=>resolve(true));});
test('installed package exports register the real two-channel readiness stack without sibling sources',async t=>{
 const f=await fixture(t),plan=await prepare(f.manifest()),events=[];
 const stack=await startStack(plan,{onEvent:event=>events.push(event)});beforeFixtureCleanup(t,()=>stack.close());
 const tools=await inspectMcp(plan.router),catalog=await inspectMcp(plan.router,'events/list');
 assert.equal(tools.status,200);assert.deepEqual(tools.body.result.tools.map(t=>t.name).sort(),['check_bridge_setup','check_lark_readiness']);
 assert.deepEqual(catalog.body.result.events,[]);
 assert.equal((await inspectMcp(plan.router,'tools/list',{key:''})).status,401);
 assert.equal(Object.keys(stack.pids()).length,3);assert.equal(events.at(-1).event,'stack_ready');
 assert.equal((await stack.close()).code,0);
 assert.ok((await Promise.all(f.ports.map(closedPort))).every(Boolean));
 const logs=JSON.stringify(events);for(const key of f.keys)assert.equal(logs.includes(fs.readFileSync(key,'utf8')),false);
});
test('single-channel mode never reads QQ configuration or starts a QQ listener',async t=>{
 const f=await fixture(t,['lark']);fs.writeFileSync(f.env.qq,'THIS_FILE_MUST_NOT_BE_PARSED=canary\nNODE_OPTIONS=--invalid\n');
 const plan=await prepare(f.manifest());const stack=await startStack(plan);beforeFixtureCleanup(t,()=>stack.close());
 const result=await inspectMcp(plan.router);assert.deepEqual(result.body.result.tools.map(x=>x.name),['check_lark_readiness']);
 assert.deepEqual(Object.keys(stack.pids()).sort(),['lark','router']);assert.equal(await closedPort(f.ports[1]),true);
});
test('unknown channels, reused keys, port collisions and dotenv loader injection fail before startup',async t=>{
 const f=await fixture(t);
 for(const change of [{channels:{telegram:f.env.qq}},{mode:'auto'},{secret:'synthetic-secret'},{systemd:{prefix:'ssh',user:'root'}}]){
  const file=f.write('invalid-'+Math.random()+'.json',JSON.stringify({...f.config,...change}));assert.throws(()=>readManifest(file));
 }
 fs.writeFileSync(f.keys[1],fs.readFileSync(f.keys[0]));await assert.rejects(prepare(f.manifest()),e=>e.code==='service_keys_reused');
 fs.writeFileSync(f.keys[1],Buffer.alloc(32,52).toString('base64url'));
 const source=fs.readFileSync(f.env.qq,'utf8');fs.writeFileSync(f.env.qq,source.replace(`PORT=${f.ports[1]}`,`PORT=${f.ports[0]}`));
 await assert.rejects(prepare(f.manifest()),e=>e.code==='router_configuration');
 fs.writeFileSync(f.env.qq,source+'NODE_OPTIONS=--require=synthetic-canary\n');assert.throws(()=>readEnvironment(f.env.qq),e=>e.code==='environment_unsafe');
 fs.writeFileSync(f.env.qq,source+'PORT=1234\n');assert.throws(()=>readEnvironment(f.env.qq),e=>e.code==='environment_unsafe');
});
test('live CLI refuses before private environment access; init cannot overwrite an existing file',async t=>{
 const f=await fixture(t);fs.writeFileSync(f.file,JSON.stringify({...f.config,mode:'live',routerEnv:path.join(f.directory,'does-not-exist.env')}));
 let result=spawnSync(process.execPath,[cli,'run','--config',f.file],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).error,'live_confirmation');
 result=spawnSync(process.execPath,[cli,'run','--config',f.file,'--channels','lark'],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).error,'arguments_invalid');
 const before=fs.readFileSync(f.file);result=spawnSync(process.execPath,[cli,'init','--config',f.file],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,1);assert.deepEqual(fs.readFileSync(f.file),before);
 assert.ok((await Promise.all(f.ports.map(closedPort))).every(Boolean));
});
test('both real packaged live configuration parsers pass offline without creating databases or printing bindings',async t=>{
 const f=await fixture(t);const qqPrivate=path.join(f.directory,'qq-private');privateMkdirSync(qqPrivate,{mode:0o700});
 const {saveQqCredentials}=await import(new URL('../src/credential-store.js',pathToFileURL(components.qq.live)).href);
 saveQqCredentials({appId:'fixture-app',appSecret:'SYNTHETIC_QQ_SECRET_ONLY',ownerOpenid:'fixture-owner',ownerEvidence:'official-qr-response'},
  {directory:qqPrivate,expectedAppId:'fixture-app',profile:'tencent-sdk'});
 const paired=f.write('lark-paired.json',JSON.stringify({version:1,status:'paired',appId:'cli_0123456789abcdef',appSecret:'SYNTHETIC_LARK_SECRET_ONLY',tenantKey:'fixture-tenant',ownerOpenId:'fixture-owner',ownerChatId:'fixture-chat'}));
 for(const [index,id] of ['lark','qq'].entries()){
  const storage=f.write(`${id}-storage.key`,Buffer.alloc(32,index+71).toString('base64url'));
  const source=fs.readFileSync(f.env[id],'utf8').replace('TUNNEL_SERVICE_OPERATION=readiness','TUNNEL_SERVICE_OPERATION=live').replace(`${id==='lark'?'LARK':'QQ'}_TRANSPORT=disabled`,`${id==='lark'?'LARK':'QQ'}_TRANSPORT=${id==='lark'?'long-connection':'gateway'}`);
  const fields=[`STORAGE_KEY_FILE=${storage}`,`DATABASE_PATH=${path.join(f.config.dataDirectory,id,'bridge.sqlite')}`,`BRIDGE_LOCK_DIRECTORY=${path.join(f.config.dataDirectory,'locks')}`,'CALLBACK_TRANSPORT_MODE=standard'];
  fields.push(...(id==='lark'?[`LARK_CREDENTIALS_FILE=${paired}`,'LARK_EXPECTED_APP_ID=cli_0123456789abcdef']:[`QQ_CREDENTIALS_FILE=${path.join(qqPrivate,'credentials.json')}`,'QQ_APP_ID=fixture-app','QQ_API_PROFILE=tencent-sdk']));
  fs.writeFileSync(f.env[id],source+fields.join('\n')+'\n');
 }
 fs.writeFileSync(f.env.router,fs.readFileSync(f.env.router,'utf8').replace('TUNNEL_SERVICE_OPERATION=readiness','TUNNEL_SERVICE_OPERATION=live'));
 fs.writeFileSync(f.file,JSON.stringify({...f.config,mode:'live'}));
 const plan=await prepare(f.manifest());assert.deepEqual(plan.router.config.liveChannels,['lark','qq']);
 const result=spawnSync(process.execPath,[cli,'doctor','--config',f.file],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stdout);assert.equal(JSON.parse(result.stdout).configurationReady,true);
 for(const value of ['fixture-owner','fixture-tenant','SYNTHETIC_QQ_SECRET_ONLY','SYNTHETIC_LARK_SECRET_ONLY'])assert.equal(result.stdout.includes(value),false);
 for(const id of ['lark','qq'])assert.equal(fs.existsSync(path.join(f.config.dataDirectory,id,'bridge.sqlite')),false);
 assert.ok((await Promise.all(f.ports.map(closedPort))).every(Boolean));
});
test('occupied ports are left untouched and aborted startup releases its own listeners',async t=>{
 const f=await fixture(t),plan=await prepare(f.manifest());const occupied=net.createServer();
 await new Promise(resolve=>occupied.listen(f.ports[0],'127.0.0.1',resolve));
 try {await assert.rejects(startStack(plan),e=>e.code==='port_busy');assert.equal(occupied.listening,true);}finally{await new Promise(resolve=>occupied.close(resolve));}
 const controller=new AbortController();controller.abort();await assert.rejects(startStack(plan,{signal:controller.signal}));
 assert.ok((await Promise.all(f.ports.map(closedPort))).every(Boolean));
});
test('component crash stops the rest of the foreground stack and returns a failed lifecycle',async t=>{
 const f=await fixture(t),stack=await startStack(await prepare(f.manifest()));beforeFixtureCleanup(t,()=>stack.close());
 process.kill(stack.pids().qq,'SIGKILL');assert.equal((await stack.closed).code,1);
 assert.ok((await Promise.all(f.ports.map(closedPort))).every(Boolean));
});
test('rendered persistent units use ordinary signal shutdown, fixed package entrypoints and three-minute grace',async t=>{
 const f=await fixture(t,['lark']);const units=renderUnits(f.manifest());
 assert.deepEqual(Object.keys(units).sort(),['dot-bridge-test-lark.service','dot-bridge-test-router.service','dot-bridge-test.target']);
 assert.match(units['dot-bridge-test-lark.service'],/TimeoutStopSec=180s/);
 assert.match(units['dot-bridge-test-lark.service'],/User=/);
 assert.match(units['dot-bridge-test-lark.service'],/ProtectSystem=strict/);
 assert.ok(!JSON.stringify(units).includes('--supervised'));assert.ok(!JSON.stringify(units).includes('DOT_BRIDGE_SUPERVISED'));
 assert.ok(!JSON.stringify(units).includes('--confirm-live'));
 const live=renderUnits({...f.manifest(),mode:'live'});assert.match(live['dot-bridge-test-lark.service'],/--confirm-live/);
});
test('systemd verifies generated units on Linux', {skip:process.platform!=='linux'},async t=>{
 const f=await fixture(t);const probe=spawnSync('systemd-analyze',['--version'],{encoding:'utf8'});
 if(probe.status!==0){t.skip('systemd-analyze is not installed');return;}
 const files=[];for(const [name,content] of Object.entries(renderUnits(f.manifest()))){const file=f.write(name,content);files.push(file);}
 const result=spawnSync('systemd-analyze',['verify','--man=no',...files],{encoding:'utf8',env:{...process.env,SYSTEMD_UNIT_PATH:f.directory+':/usr/lib/systemd/system:/lib/systemd/system'}});
 assert.equal(result.status,0,result.stderr);
});
