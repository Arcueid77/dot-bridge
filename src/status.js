import {components} from './components.js';
import {inspectMcp,inspectReadiness} from './rpc.js';

const stages=new Set(['validate','policy','transport','challenge','persist','complete']);
const reasons=new Set(['invalid_request','callback_policy_required','transport_unavailable','challenge_failed','timeout','subscription_conflict','subscription_cancelled','storage_unavailable','subscribed']);
const codes=new Set([-32602,-32603,-32012,-32013,-32014,-32015]);
const host=value=>typeof value==='string'&&value.length<=253&&/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/u.test(value);
const boolean=value=>typeof value==='boolean'?value:null;

export function safeChannelStatus(id,config,value) {
  const attempts=Array.isArray(value?.subscription_diagnostics)?value.subscription_diagnostics.slice(-5):[];
  const subscriptionDiagnostics=attempts.filter(item=>item&&stages.has(item.stage)&&reasons.has(item.reason)&&
    (item.code===null||codes.has(item.code))&&typeof item.at==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(item.at)&&
    Number.isFinite(Date.parse(item.at))&&(item.hostname===null||host(item.hostname))).map(item=>({at:item.at,stage:item.stage,code:item.code,reason:item.reason,hostname:item.hostname}));
  return {channel:id,authenticatedMcpReachable:true,bindingReady:boolean(value?.binding_ready),
    gatewayConnected:boolean(value?.gateway_connected),subscriptionActive:boolean(value?.subscription_active??value?.mcp_subscription_active),
    callbackHostCount:config.callbackHosts?.length??0,pendingMessageCount:Array.isArray(value?.pending_messages)?value.pending_messages.length:null,
    subscriptionDiagnostics,diagnosticHistoryAvailable:Array.isArray(value?.subscription_diagnostics)};
}

export async function inspectChannels(plan,{inspect=inspectMcp,readiness=inspectReadiness}={}) {
  return Promise.all(plan.manifest.selected.map(async id=>{
    const backend=plan.backends[id];
    if(!backend)return {channel:id,authenticatedMcpReachable:false,configurationError:plan.errors?.[id]??'configuration_unavailable'};
    try{
      const name=components[id].adapter.backendSetupTool.name;
      const response=await inspect(backend,'tools/call',{params:{name,arguments:{}},timeout:5000});
      if(response.status!==200||response.body?.result?.isError!==false||!response.body.result.structuredContent)throw Error();
      const value={...response.body.result.structuredContent};
      if(['lark','qq'].includes(id)){
        try{const ready=await readiness(backend);for(const key of ['binding_ready','gateway_connected','mcp_subscription_active'])if(typeof ready?.[key]==='boolean')value[key]=ready[key];}catch{/* Unknown is not false. */}
      }
      return safeChannelStatus(id,backend.config,value);
    }catch{return {channel:id,authenticatedMcpReachable:false,callbackHostCount:backend.config.callbackHosts?.length??0};}
  }));
}
