import test from 'node:test';
import assert from 'node:assert/strict';
import {safeChannelStatus,inspectChannels} from '../src/status.js';
import {onboarding,onboardingText} from '../src/onboarding.js';
import {prepareStatus} from '../src/config.js';
import {fixture} from './fixture.js';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('status retains useful stages and strips message identities, callbacks and injected errors',()=>{
 const item={at:'2026-10-23T00:00:00.000Z',stage:'challenge',code:-32015,reason:'challenge_failed',hostname:'callback.example.com',secret:'private'};
 const value=safeChannelStatus('telegram',{callbackHosts:['callback.example.com']},{binding_ready:true,gateway_connected:true,subscription_active:false,pending_messages:[{message_id:'private-id',text:'private text'}],subscription_diagnostics:[item,{...item,reason:'private exception'},{...item,hostname:'https://callback.example.com/secret'}],token:'private-token'});
 assert.equal(value.pendingMessageCount,1);assert.equal(value.subscriptionActive,false);assert.equal(value.callbackHostCount,1);assert.equal(value.subscriptionDiagnostics.length,1);
 assert.equal(JSON.stringify(value).includes('private'),false);assert.equal(JSON.stringify(value).includes('/secret'),false);
});
test('one failed channel does not hide other channel states and checks never subscribe',async()=>{
 const calls=[],plan={manifest:{selected:['telegram','discord']},backends:{telegram:{id:'telegram',config:{callbackHosts:[]}},discord:{id:'discord',config:{callbackHosts:[]}}}};
 const result=await inspectChannels(plan,{inspect:async(endpoint,method,{params})=>{calls.push({method,params});if(endpoint.id==='discord')throw Error('secret token');return {status:200,body:{result:{isError:false,structuredContent:{binding_ready:true}}}};}});
 assert.equal(result[0].bindingReady,true);assert.equal(result[1].authenticatedMcpReachable,false);assert.equal(JSON.stringify(result).includes('secret'),false);
 assert.equal(calls.every(c=>c.method==='tools/call'&&c.params.name.startsWith('check_')),true);
});
test('each installed channel has an actionable setup guide and owner-only event name',()=>{
 assert.equal(Object.keys(onboarding).length,8);
 for(const id of Object.keys(onboarding)){const text=onboardingText([id]);assert.ok(text.includes(`${id}.message.created`));assert.ok(text.includes('conversation=owner'));assert.ok(onboarding[id].credentials.length);}
});
test('status keeps a working backend when another private environment is missing',async t=>{
 const f=await fixture(t),manifest=f.manifest();fs.renameSync(f.env.qq,path.join(f.directory,'qq-saved.env'));
 const plan=await prepareStatus(manifest);assert.ok(plan.backends.lark);assert.equal(plan.backends.qq,undefined);assert.equal(plan.errors.qq,'environment_unsafe');assert.equal(plan.router,undefined);
 const result=await inspectChannels(plan,{inspect:async()=>({status:200,body:{result:{isError:false,structuredContent:{binding_ready:true,delivery_configured:true}}}}),readiness:async()=>({gateway_connected:false,mcp_subscription_active:false,owner:'private'})});
 const lark=result.find(x=>x.channel==='lark');assert.equal(lark.bindingReady,true);assert.equal(lark.subscriptionActive,false);assert.equal(lark.gatewayConnected,false);assert.equal(JSON.stringify(result).includes('private'),false);
});
test('legacy setup configuration never stands in for gateway or subscription state',async()=>{
 const plan={manifest:{selected:['qq']},backends:{qq:{config:{callbackHosts:[]}}}};
 const inspect=async()=>({status:200,body:{result:{isError:false,structuredContent:{configuration_ready:true,events_discoverable:true}}}});
 const [unknown]=await inspectChannels(plan,{inspect,readiness:async()=>{throw Error();}});assert.equal(unknown.subscriptionActive,null);assert.equal(unknown.gatewayConnected,null);
 const [ready]=await inspectChannels(plan,{inspect,readiness:async()=>({binding_ready:true,gateway_connected:true,mcp_subscription_active:false})});assert.equal(ready.bindingReady,true);assert.equal(ready.gatewayConnected,true);assert.equal(ready.subscriptionActive,false);
});
test('guide rejects an explicitly empty channel list',()=>{
 const result=spawnSync(process.execPath,['bin/dotbridge.js','guide','--channels',''],{encoding:'utf8',windowsHide:true});assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).error,'channels_invalid');
});

test('management projection accepts only actual fixed subscription, connection and full queue fields',()=>{
 const value=safeChannelStatus('telegram',{callbackHosts:[]},{subscription_status:{state:'active',expires_at:'2026-11-01T00:00:00.000Z',remaining_seconds:3600,renewal_owner:'host',diagnostics_available:true,secret:'private'},connection_status:{stage:'subscription',reason:'subscription_failed',next_step:'inspect_subscription_diagnostics',callback_hosts_count:0,diagnostic_history:'available',owner:'private'},reply_work:{pending:11,processing:2,uncertain:1,identity:'private'}});
 assert.equal(value.subscriptionStatus.expiresAt,'2026-11-01T00:00:00.000Z');assert.equal(value.replyWork.pending,11);assert.equal(value.connectionStatus.reason,'subscription_failed');assert.equal(JSON.stringify(value).includes('private'),false);
 const bad=safeChannelStatus('telegram',{}, {subscription_status:{state:'active',expires_at:'private callback',renewal_owner:'attacker'},connection_status:{stage:'subscription',reason:'private_identity',next_step:'inspect_subscription_diagnostics'},reply_work:{pending:-1,processing:0,uncertain:0}});
 assert.equal(bad.subscriptionStatus,null);assert.equal(bad.connectionStatus,null);assert.equal(bad.replyWork,null);
});

test('management keeps only recognized callback setting names and boolean mismatch flags',()=>{
 const connection={stage:'callback_policy',reason:'callback_hosts_empty',next_step:'approve_callback_hostname',callback_hosts_count:0,diagnostic_history:'unavailable',callback_setting_name:'MCP_CALLBACK_ALLOWED_HOSTS',wrong_callback_setting_present:true};
 const value=safeChannelStatus('lark',{}, {connection_status:connection});
 assert.equal(value.connectionStatus.callbackSettingName,'MCP_CALLBACK_ALLOWED_HOSTS');
 assert.equal(value.connectionStatus.wrongCallbackSettingPresent,true);
 const observed=safeChannelStatus('lark',{callbackHosts:['not-yet-loaded.example.com']},{connection_status:connection});
 assert.equal(observed.callbackHostCount,0);
 const rejected=safeChannelStatus('lark',{}, {connection_status:{...connection,callback_setting_name:'private-value',wrong_callback_setting_present:'private-value'}});
 assert.equal(rejected.connectionStatus.callbackSettingName,null);assert.equal(rejected.connectionStatus.wrongCallbackSettingPresent,null);
 assert.equal(JSON.stringify(rejected).includes('private-value'),false);
});
