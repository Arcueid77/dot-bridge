import {inspectMcp, inspectRuntime} from './rpc.js';
import {toolCatalog, eventCatalog} from '@dot-bridge/core/router/catalog.js';
import {catalogFingerprint} from '@dot-bridge/core/router/runtime.js';

export async function inspectCatalog(plan, {inspect = inspectMcp, runtime = inspectRuntime} = {}) {
  if (!plan.router) return {reachable: false, runtime: null, matchesInstalled: null};
  const endpoint=plan.router;
  let value;
  try { value=await runtime(endpoint); } catch { /* Older routers only expose MCP catalogs. */ }
  let observedRuntime = null;
  if (value && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(value.version ?? '') &&
      (value.revision === null || /^[a-f0-9]{40}$/u.test(value.revision ?? '')) &&
      ['dot-bridge','@dot-bridge/core'].includes(value.package) &&
      ['git','archive','unknown'].includes(value.source_kind)) {
    observedRuntime = {package: value.package, version: value.version, revision: value.revision,
      sourceKind: value.source_kind, worktreeDirty: typeof value.worktree_dirty === 'boolean' ? value.worktree_dirty : null};
  }
  const installedTools=toolCatalog(endpoint.config), installedEvents=eventCatalog(endpoint.config);
  const expected=catalogFingerprint(installedTools,installedEvents);
  const catalog=value?.catalog;
  // The authenticated runtime response already checks every live backend's
  // catalog. Reuse that snapshot for this inspection.
  if (observedRuntime && /^[a-f0-9]{64}$/u.test(catalog?.fingerprint ?? '') &&
      [catalog.tools,catalog.events].every(count=>Number.isSafeInteger(count)&&count>=0) &&
      catalog.upstream_verified === (endpoint.config.operation === 'live')) {
    return {reachable:true,runtime:observedRuntime,toolCount:catalog.tools,eventCount:catalog.events,
      fingerprint:catalog.fingerprint,matchesInstalled:catalog.fingerprint===expected&&
        catalog.tools===installedTools.length&&catalog.events===installedEvents.length,
      runtimeCatalogMatches:null,upstreamCatalogVerified:catalog.upstream_verified,clientDirectoryChecked:false};
  }
  const [toolResult,eventResult]=await Promise.allSettled([inspect(endpoint),inspect(endpoint,'events/list')]);
  const tools=toolResult.value, events=eventResult.value;
  const reachable=tools?.status===200&&events?.status===200&&
    Array.isArray(tools.body?.result?.tools)&&Array.isArray(events.body?.result?.events);
  if (!reachable) return {reachable, runtime: observedRuntime, matchesInstalled: null};
  let actual;
  try {
    if ([...tools.body.result.tools,...events.body.result.events].some(item=>!item||typeof item.name!=='string'||!item.name||item.name.length>256)) throw Error();
    actual = catalogFingerprint(tools.body.result.tools, events.body.result.events);
  } catch {return {reachable:false,runtime:observedRuntime,matchesInstalled:null};}
  return {reachable, runtime: observedRuntime, toolCount: tools.body.result.tools.length,
    eventCount: events.body.result.events.length, fingerprint: actual, matchesInstalled: actual === expected,
    runtimeCatalogMatches: typeof value?.catalog?.fingerprint === 'string' ? value.catalog.fingerprint === actual : null,
    clientDirectoryChecked: false};
}
