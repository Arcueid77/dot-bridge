import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {OwnerOutbox,OutboundRejection} from '@dot-bridge/core/channels/outbound.js';
import {ChannelStore} from '@dot-bridge/core/channels/store.js';
import {toolResult} from '@dot-bridge/core/router/common.js';
import {components} from '../src/components.js';

test('packaged QQ exposes owner scheduling and projects durable platform rejection using the installed shared core',async t=>{
  const adapter=components.qq.adapter,db=new DatabaseSync(':memory:'),cipher={key:Buffer.alloc(32,81)};
  t.after(()=>db.close());
  const names=adapter.liveTools.map(tool=>tool.name);
  for(const name of ['send_qq_message','schedule_qq_message','get_qq_outbound','list_qq_scheduled_messages','update_qq_scheduled_message','cancel_qq_scheduled_message'])assert.ok(names.includes(name));
  let attempts=0;
  const box=new OwnerOutbox({channel:'qq',db,enabled:true,available:()=>true,
    seal:(value,aad)=>ChannelStore.prototype.seal.call(cipher,value,aad),
    open:(value,aad)=>ChannelStore.prototype.open.call(cipher,value,aad),
    send:async args=>{args.authorize();attempts++;throw new OutboundRejection('provider_permission_denied');}});
  const args={conversation:'owner',text:'synthetic packaged notification',idempotency_key:'packaged-qq-intent'};
  assert.deepEqual(adapter.validateToolArguments('send_qq_message',args,true),args);
  const saved=box.call('send_qq_message',args);await box.tick();await box.tick();
  const call={name:'get_qq_outbound',arguments:{outbound_id:saved.outbound_id}},result=box.call(call.name,call.arguments);
  assert.equal(attempts,1);assert.equal(result.status,'rejected');assert.equal(result.reason,'provider_permission_denied');
  assert.deepEqual(adapter.projectToolResult(call,toolResult(result),true),result);
  assert.throws(()=>adapter.validateToolArguments('send_qq_message',{...args,recipient:'other'},true));
  assert.equal(db.prepare('SELECT payload FROM dotbridge_outbound').get().payload.includes(args.text),false);
  await box.close();
});
