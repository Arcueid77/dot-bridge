import {inspectMcp, inspectRuntime} from './rpc.js';
import {toolCatalog, eventCatalog} from '@dot-bridge/core/router/catalog.js';
import {catalogFingerprint} from '@dot-bridge/core/router/runtime.js';

export async function inspectCatalog(plan, {inspect = inspectMcp, runtime = inspectRuntime} = {}) {
  if (!plan.router) return {reachable: false, runtime: null, matchesInstalled: null};
  const results = await Promise.allSettled([
    inspect(plan.router), inspect(plan.router, 'events/list'), runtime(plan.router),
  ]);
  const tools = results[0].value, events = results[1].value;
  const reachable = tools?.status === 200 && events?.status === 200 &&
    Array.isArray(tools.body?.result?.tools) && Array.isArray(events.body?.result?.events);
  const value = results[2].value;
  let observedRuntime = null;
  if (value && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(value.version ?? '') &&
      (value.revision === null || /^[a-f0-9]{40}$/u.test(value.revision ?? '')) &&
      ['dot-bridge','@dot-bridge/core'].includes(value.package) &&
      ['git','archive','unknown'].includes(value.source_kind)) {
    observedRuntime = {package: value.package, version: value.version, revision: value.revision,
      sourceKind: value.source_kind, worktreeDirty: typeof value.worktree_dirty === 'boolean' ? value.worktree_dirty : null};
  }
  if (!reachable) return {reachable, runtime: observedRuntime, matchesInstalled: null};
  let actual, expected;
  try {
    if ([...tools.body.result.tools,...events.body.result.events].some(item=>!item||typeof item.name!=='string'||!item.name||item.name.length>256)) throw Error();
    actual = catalogFingerprint(tools.body.result.tools, events.body.result.events);
    expected = catalogFingerprint(toolCatalog(plan.router.config), eventCatalog(plan.router.config));
  } catch {return {reachable:false,runtime:observedRuntime,matchesInstalled:null};}
  return {reachable, runtime: observedRuntime, toolCount: tools.body.result.tools.length,
    eventCount: events.body.result.events.length, fingerprint: actual, matchesInstalled: actual === expected,
    runtimeCatalogMatches: typeof value?.catalog?.fingerprint === 'string' ? value.catalog.fingerprint === actual : null,
    clientDirectoryChecked: false};
}
