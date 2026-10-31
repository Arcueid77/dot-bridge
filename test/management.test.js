import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {startManagement,channelPresentation,setupGuide,availableReleases,verifyRelease} from '../src/management.js';
import {readManifest} from '../src/config.js';
import {fixture} from './fixture.js';

const root=fileURLToPath(new URL('../',import.meta.url));
async function server(t,options={}){const ui=await startManagement({port:0,...options});t.after(()=>ui.close());return ui;}
async function session(ui){return (await (await fetch(ui.url+'/api/session')).json()).token;}
const post=(ui,token,route,body,headers={})=>fetch(ui.url+route,{method:'POST',headers:{Origin:ui.url,'Content-Type':'application/json','X-DotBridge-Session':token,...headers},body:JSON.stringify(body)});

test('an external link can open the static page while APIs and embedded cross-site content stay blocked',async t=>{
  const ui=await server(t,{demo:true});
  const headers={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
  const get=(route,extra={})=>new Promise((resolve,reject)=>{http.get(ui.url+route,{headers:{...headers,...extra}},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode,body}));}).once('error',reject);});
  const page=await get('/');assert.equal(page.status,200);assert.ok(page.body.includes('<!doctype html>'));
  assert.equal((await get('/api/session')).status,403);
  assert.equal((await get('/api/state')).status,403);
  assert.equal((await get('/',{'Sec-Fetch-Dest':'iframe'})).status,403);
});

test('channel labels require real binding, gateway and subscription instead of configuration presence',()=>{
  assert.equal(channelPresentation({authenticatedMcpReachable:true}).state,'unknown');
  assert.equal(channelPresentation({authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:false}).state,'needs_subscription');
  assert.equal(channelPresentation({authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:false,subscriptionStatus:{state:'unknown',expiresAt:null}}).state,'needs_subscription');
  assert.equal(channelPresentation({authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:true}).state,'ready');
  const activeUnknownTtl=channelPresentation({authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:true,subscriptionStatus:{state:'unknown',expiresAt:null}});assert.equal(activeUnknownTtl.state,'ready');assert.ok(activeUnknownTtl.detail.includes('未提供有效期'));
  assert.equal(channelPresentation({authenticatedMcpReachable:true},{mode:'readiness'}).state,'readiness');
  assert.equal(channelPresentation(null,{selected:false}).state,'not_selected');
});
test('expiry warnings use actual returned expiry and missing expiry stays unknown',()=>{
  const now=Date.parse('2026-10-31T00:00:00.000Z'),value={authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:true,subscriptionActive:true};
  assert.equal(channelPresentation({...value,subscriptionStatus:{expiresAt:'2026-10-30T23:59:00.000Z'}},{now}).state,'subscription_expired');
  assert.equal(channelPresentation({...value,subscriptionStatus:{expiresAt:'2026-10-31T01:00:00.000Z'}},{now}).state,'expiring');
  assert.equal(channelPresentation(value,{now}).state,'ready');
});

test('gateway waiting for a legacy subscription is not diagnosed as a network failure',()=>{
  const value={authenticatedMcpReachable:true,bindingReady:true,gatewayConnected:false,subscriptionActive:false,connectionStatus:{stage:'subscription',reason:'subscription_missing'},subscriptionStatus:{state:'none'}};
  assert.equal(channelPresentation(value).state,'needs_subscription');
  assert.equal(channelPresentation({...value,subscriptionStatus:{state:'expired'}}).state,'subscription_expired');
  assert.equal(channelPresentation({...value,connectionStatus:{stage:'subscription',reason:'subscription_failed'}}).state,'subscription_error');
  assert.equal(channelPresentation({...value,subscriptionStatus:{state:'unknown'},connectionStatus:{stage:'subscription',reason:'subscription_unknown'}}).state,'unknown');
  assert.equal(channelPresentation({...value,connectionStatus:{stage:'callback_policy',reason:'callback_hosts_empty'}}).state,'callback_policy');
  assert.equal(channelPresentation({...value,connectionStatus:{stage:'gateway',reason:'gateway_disconnected'}}).state,'gateway_offline');
});
test('pairing guidance preserves an existing binding and uses original-dot event prompts',()=>{
  const guide=setupGuide('telegram',{bindingReady:true});
  assert.ok(guide.pairingNotice.includes('不要重新配对'));
  assert.ok(guide.commands[0].includes('--token-file'));
  assert.ok(guide.subscriptionPrompt.includes('telegram.message.created'));
  assert.ok(guide.subscriptionPrompt.includes('conversation=owner'));
  assert.ok(guide.subscriptionPrompt.includes('已有则复用'));
  assert.ok(!guide.subscriptionPrompt.includes('https://'));
  assert.ok(setupGuide('qq').pairingNotice.includes('尚未核对'));
});
test('demo is explicitly synthetic, serves eight channels and applies browser isolation headers',async t=>{
  const ui=await server(t,{demo:true}),response=await fetch(ui.url),html=await response.text();
  assert.equal(response.status,200);assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  assert.ok(!response.headers.get('content-security-policy').includes('unsafe-inline'));
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.ok(html.includes('type="module"'));assert.ok(!html.includes('X-DotBridge-Session'));
  for(const [asset,type] of [['/app.js','text/javascript'],['/app.css','text/css']]){const resource=await fetch(ui.url+asset);assert.equal(resource.status,200);assert.ok(resource.headers.get('content-type').startsWith(type));assert.ok((await resource.text()).length>100);}
  const value=await (await fetch(ui.url+'/api/state')).json();assert.equal(value.demo,true);assert.equal(value.channels.length,8);
  assert.ok(value.notice.includes('不连接任何平台'));assert.equal(value.channels.find(c=>c.id==='telegram').presentation.state,'needs_subscription');
  const token=await session(ui);assert.equal(token.length,43);
  const mutation=await post(ui,token,'/api/save-config',{channels:['telegram'],confirm:true});assert.equal(mutation.status,409);assert.equal((await mutation.json()).error,'demo_read_only');
});
test('Host, Origin, cross-site requests and session query parameters cannot reach the API',async t=>{
  const ui=await server(t,{demo:true});
  const wrongHost=await new Promise((resolve,reject)=>{const request=http.get(ui.url+'/api/state',{headers:{Host:'attacker.example'}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode));});request.once('error',reject);});assert.equal(wrongHost,403);
  assert.equal((await fetch(ui.url+'/api/state',{headers:{Origin:'https://attacker.example'}})).status,403);
  assert.equal((await fetch(ui.url+'/api/session',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await fetch(ui.url+'/api/session?token=anything')).status,404);
  assert.equal((await fetch(ui.url+'/private/secret.env')).status,404);
});
test('mutations require exact origin, unpredictable memory session and bounded JSON',async t=>{
  const ui=await server(t,{demo:true}),token=await session(ui);
  assert.equal((await post(ui,'x'.repeat(43),'/api/check-config',{})).status,403);
  assert.equal((await post(ui,token,'/api/check-config',{}, {Origin:'null'})).status,403);
  assert.equal((await post(ui,token,'/api/check-config',{}, {'Content-Type':'text/plain'})).status,415);
  const noOrigin=await fetch(ui.url+'/api/check-config',{method:'POST',headers:{'Content-Type':'application/json','X-DotBridge-Session':token},body:'{}'});assert.equal(noOrigin.status,403);
});
test('configuration checks do not write, save requires confirmation and stale saves preserve other changes',async t=>{
  const f=await fixture(t),original=fs.readFileSync(f.file,'utf8'),snapshot={revision:null,channels:[],work:{known:false,pending:null,processing:null,uncertain:null}};
  const ui=await server(t,{configFile:f.file,loadState:()=>snapshot}),token=await session(ui);
  let response=await post(ui,token,'/api/check-config',{channels:['lark']});assert.equal(response.status,200);assert.equal(fs.readFileSync(f.file,'utf8'),original);
  response=await post(ui,token,'/api/save-config',{channels:['lark']});assert.equal(response.status,400);assert.equal(fs.readFileSync(f.file,'utf8'),original);
  const {createHash}=await import('node:crypto'),manifest=readManifest(f.file),plain={version:manifest.version,mode:manifest.mode,channels:{...manifest.channels},routerEnv:manifest.routerEnv,dataDirectory:manifest.dataDirectory,systemd:{...manifest.systemd}};
  const revision=createHash('sha256').update(JSON.stringify(plain)).digest('hex');
  response=await post(ui,token,'/api/save-config',{channels:['lark'],confirm:true,revision});assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.credentialsChanged,false);assert.equal(saved.subscriptionsChanged,false);assert.equal(saved.restartRequired,true);
  assert.deepEqual(readManifest(f.file).selected,['lark']);const backup=fs.readdirSync(f.directory).find(name=>name.startsWith('bridge.json.before-ui-'));assert.ok(backup);assert.equal(fs.readFileSync(path.join(f.directory,backup),'utf8'),original);
  const current=fs.readFileSync(f.file,'utf8');response=await post(ui,token,'/api/save-config',{channels:['qq'],confirm:true,revision});assert.equal(response.status,409);assert.equal(fs.readFileSync(f.file,'utf8'),current);
});
test('the browser cannot choose arbitrary file paths, callback policy, credentials or shell commands',async t=>{
  const f=await fixture(t),ui=await server(t,{configFile:f.file,prepareCandidate:async()=>({})}),token=await session(ui);
  for(const body of [{channels:['lark'],file:'/elsewhere'},{channels:['lark'],CALLBACK_HOSTS:'*'},{channels:['lark'],token:'private-value'},{channels:['lark'],command:'anything'},{channels:['../private']}]){
    const response=await post(ui,token,'/api/check-config',body);assert.equal(response.status,400);assert.equal(JSON.stringify(await response.json()).includes('private-value'),false);
  }
  const huge=await fetch(ui.url+'/api/check-config',{method:'POST',headers:{Origin:ui.url,'Content-Type':'application/json','X-DotBridge-Session':token},body:JSON.stringify({channels:['lark'],extra:'x'.repeat(9000)})});assert.equal(huge.status,413);
});
test('unexpected provider or filesystem errors never pass raw messages through an HTTP status property',async t=>{
  const f=await fixture(t),ui=await server(t,{configFile:f.file,prepareCandidate:async()=>{throw Object.assign(Error('private identity, callback and credential'),{status:418});}}),token=await session(ui);
  const response=await post(ui,token,'/api/check-config',{channels:['lark']}),value=await response.json();assert.equal(response.status,400);assert.equal(JSON.stringify(value).includes('credential'),false);assert.equal(JSON.stringify(value).includes('private identity'),false);
});
function copyRelease(directory){const target=path.join(directory,'release-current');fs.mkdirSync(target);fs.mkdirSync(path.join(target,'vendor'));for(const name of ['package.json','package-lock.json','components.lock.json'])fs.copyFileSync(path.join(root,name),path.join(target,name));const lock=JSON.parse(fs.readFileSync(path.join(root,'components.lock.json')));for(const item of Object.values(lock.components))fs.copyFileSync(path.join(root,item.artifact),path.join(target,item.artifact));return {target,lock};}
test('upgrade preflight checks real package integrity and rejects path escapes and changed artifacts',async t=>{
  const f=await fixture(t),{target,lock}=copyRelease(f.directory);
  assert.ok(availableReleases(f.directory).some(r=>r.id==='release-current'));
  const result=verifyRelease(f.directory,'release-current',f.manifest());assert.equal(result.integrityVerified,true);assert.equal(result.sourceReviewRequired,true);assert.equal(result.components.length,9);assert.equal(result.compatibility.targetDoctorRequired,true);
  assert.throws(()=>verifyRelease(f.directory,'../elsewhere',f.manifest()));
  fs.appendFileSync(path.join(target,lock.components.core.artifact),'tampered');assert.throws(()=>verifyRelease(f.directory,'release-current',f.manifest()),/不一致/);
});
test('upgrade operation sheet is concrete and keeps unknown queues as blockers, without executing target code',async t=>{
  const f=await fixture(t);copyRelease(f.directory);
  const ui=await server(t,{configFile:f.file,releasesDir:f.directory,loadState:()=>({work:{known:false,pending:null,processing:null,uncertain:null}}),prepareCandidate:async()=>({})}),token=await session(ui);
  const checked=await post(ui,token,'/api/check-release',{release:'release-current'}),value=await checked.json();assert.equal(value.upgraded,false);assert.ok(value.blockers.includes('reply_work_unknown'));assert.ok(value.blockers.includes('consistent_backup_required'));
  assert.equal(value.rollbackChecks.replyWorkClear,null);assert.equal(value.rollbackChecks.qqMediaHistoryCompatible,null);assert.ok(value.blockers.includes('rollback_compatibility_review_required'));
  const response=await post(ui,token,'/api/upgrade-plan',{release:'release-current'}),text=await response.text();assert.equal(response.status,200);assert.ok(response.headers.get('content-disposition').includes('attachment'));assert.ok(text.includes('npm ci --omit=dev --ignore-scripts'));assert.ok(text.includes('SQLite 一致性备份'));assert.ok(text.includes('当前组件未提供完整计数'));assert.ok(text.includes('目标版本的数据兼容性与 QQ 媒体历史'));
  assert.equal(fs.existsSync(path.join(f.directory,'release-current','node_modules')),false);
});
