import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawnSync} from 'node:child_process';
import {components,channelIds} from '../src/components.js';
import {fixture} from './fixture.js';
import {prepare,readManifest} from '../src/config.js';
import {startStack} from '../src/stack.js';
import {inspectMcp} from '../src/rpc.js';
import {createUpstreamClient} from '@dot-bridge/core/router/upstream.js';
import {beforeFixtureCleanup,privateMkdirSync} from '@dot-bridge/core/platform/test-fixtures.js';

const newIds=['dingtalk','wecom','weixin','discord','telegram','line'];
async function extraPorts(count){const servers=await Promise.all(Array.from({length:count},()=>new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>resolve(s));})));const ports=servers.map(s=>s.address().port);await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));return ports;}
test('all eight installed channels run provider-disabled readiness and authenticate through their actual adapters',async t=>{
 const f=await fixture(t),ports=await extraPorts(newIds.length),channels={...f.config.channels};
 for(const[index,id]of newIds.entries()){
  const key=f.write(`${id}.key`,Buffer.alloc(32,index+71).toString('base64url'));
  channels[id]=f.write(`${id}.env`,['AUTH_MODE=tunnel-service','BRIDGE_MODE=tunnel','TUNNEL_SERVICE_OPERATION=readiness','TUNNEL_SERVICE_OWNER_ID=tunnel-owner:dot-bridge',`PORT=${ports[index]}`,`TUNNEL_SERVICE_KEY_FILE=${key}`,`${components[id].adapter.envPrefix}_TRANSPORT=disabled`].join('\n'));
  privateMkdirSync(path.join(f.config.dataDirectory,id),{mode:0o700});
 }
 const file=f.write('eight.json',JSON.stringify({...f.config,channels}));const manifest=readManifest(file),plan=await prepare(manifest);
 assert.deepEqual(manifest.selected,[...channelIds].sort());const stack=await startStack(plan,{startupMs:60000});beforeFixtureCleanup(t,()=>stack.close());
 const tools=await inspectMcp(plan.router);assert.equal(tools.status,200);assert.equal(tools.body.result.tools.length,8);assert.deepEqual((await inspectMcp(plan.router,'events/list')).body.result.events,[]);
 assert.equal(Object.keys(stack.pids()).length,9);
 const client=createUpstreamClient(plan.router.config,Object.fromEntries(Object.entries(plan.backends).map(([id,b])=>[id,b.key])));beforeFixtureCleanup(t,()=>client.close());
 for(const id of channelIds){const result=await client.tool({name:components[id].adapter.readinessTool.name,arguments:{}});if(id==='qq'){assert.equal(result.configuration_ready,false);assert.equal(result.events_discoverable,false);assert.equal(result.network_checked,false);}else{assert.equal(result.authenticated_mcp_reachable,true);assert.equal(result.readiness_catalog_only,true);}}
 await stack.close();assert.equal(fs.readdirSync(f.config.dataDirectory,{recursive:true}).some(file=>file.endsWith('.sqlite')),false);
});

test('each new package live configuration stays offline and readiness rejects a live environment',async t=>{
 const f=await fixture(t);
 for(const[index,id]of newIds.entries()){
  privateMkdirSync(path.join(f.config.dataDirectory,id),{mode:0o700});
  const prefix=components[id].adapter.envPrefix,dbPath=path.join(f.config.dataDirectory,id,'bridge.sqlite');
  const credentials=f.write(`${id}.json`,JSON.stringify({ownerId:'fixture-owner',conversationId:'fixture-chat'}));
  const storage=f.write(`${id}.storage.key`,Buffer.alloc(32,index+91).toString('base64'));
  const key=f.write(`${id}.service.key`,Buffer.alloc(32,index+101).toString('base64url'));
  const env={AUTH_MODE:'tunnel-service',BRIDGE_MODE:'tunnel',TUNNEL_SERVICE_OPERATION:'live',TUNNEL_SERVICE_OWNER_ID:'tunnel-owner:dot-bridge',PORT:String(components[id].adapter.defaultPort),TUNNEL_SERVICE_KEY_FILE:key,[`${prefix}_CREDENTIALS_FILE`]:credentials,STORAGE_KEY_FILE:storage,DATABASE_PATH:dbPath,BRIDGE_LOCK_DIRECTORY:path.join(f.config.dataDirectory,'locks'),CALLBACK_TRANSPORT_MODE:'standard',CALLBACK_HOSTS:'callback.example.com'};
  const {readConfig}=await components[id].config();assert.equal(readConfig(env).dbPath,dbPath);assert.equal(fs.existsSync(dbPath),false);
  const result=spawnSync(process.execPath,[components[id].readiness],{env:{...process.env,...env},encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(result.status,1);assert.equal(fs.existsSync(dbPath),false);assert.equal(result.stderr.includes('fixture-owner'),false);
  const unconfirmed=spawnSync(process.execPath,[components[id].live],{env:{...process.env,TUNNEL_SERVICE_OPERATION:'live'},encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(unconfirmed.status,0);assert.match(unconfirmed.stdout,/requires --confirm-live/);
 }
});
