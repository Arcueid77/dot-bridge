import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';
import {readManifest,prepareStatus} from '../src/config.js';
import {inspectCatalog} from '../src/catalog-status.js';
import {toolCatalog,eventCatalog} from '@dot-bridge/core/router/catalog.js';
import {catalogFingerprint} from '@dot-bridge/core/router/runtime.js';

test('runtime and installed catalogs are reconciled without claiming the original dot was refreshed',async t=>{
  const f=await fixture(t,['lark']),plan=await prepareStatus(readManifest(f.file));
  const tools=toolCatalog(plan.router.config),events=eventCatalog(plan.router.config);
  let actual=tools;
  const inspect=async(_endpoint,method)=>({status:200,body:{result:method==='events/list'?{events}:{tools:actual}}});
  const runtime=async()=>({package:'dot-bridge',version:'0.10.0',revision:'a'.repeat(40),source_kind:'git',worktree_dirty:null,
    catalog:{fingerprint:catalogFingerprint(tools,events)},private_value:'fixture-secret-must-not-escape'});
  const status=await inspectCatalog(plan,{inspect,runtime});
  assert.equal(status.matchesInstalled,true);assert.equal(status.runtimeCatalogMatches,true);
  assert.equal(status.clientDirectoryChecked,false);assert.equal(status.runtime.revision,'a'.repeat(40));
  assert.equal(JSON.stringify(status).includes('fixture-secret'),false);
  actual=[{...tools[0],description:'different installed contract'}];
  assert.equal((await inspectCatalog(plan,{inspect,runtime})).matchesInstalled,false);
  actual=[{}];assert.equal((await inspectCatalog(plan,{inspect,runtime})).reachable,false);
});
