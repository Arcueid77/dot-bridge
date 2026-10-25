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
