import http from 'node:http';
import {VERSION,SERVICE_HEADER,metadata} from '@dot-bridge/core/router/common.js';
import {OperatorError} from './errors.js';
export function inspectReadiness(endpoint,{timeout=2000}={}) {
  return new Promise((resolve,reject)=>{
    if(endpoint.host!=='127.0.0.1'){reject(new OperatorError('listener_invalid','状态检查只访问本机监听。'));return;}
    let timer,size=0;const chunks=[];
    const fail=()=>{clearTimeout(timer);reject(new OperatorError('readiness_unavailable','本机状态暂不可用。'));};
    const request=http.get({host:endpoint.host,port:endpoint.port,path:'/readyz',agent:false,headers:{accept:'application/json'}},response=>{
      response.on('data',chunk=>{size+=chunk.length;if(size>65536)request.destroy();else chunks.push(chunk);});response.on('error',fail);
      response.on('end',()=>{clearTimeout(timer);try{if(![200,503].includes(response.statusCode))throw Error();resolve(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))));}catch{fail();}});
    });
    timer=setTimeout(()=>request.destroy(),timeout);request.on('error',fail);
  });
}
export function inspectMcp(endpoint,method='tools/list',{timeout=2000,key=endpoint.key,params={}}={}) {
  return new Promise((resolve,reject)=>{
    const bytes=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,method,params:{...params,_meta:metadata()}}));
    let timer,size=0;const chunks=[];
    const fail=()=>{clearTimeout(timer);reject(new OperatorError('mcp_unavailable','本地 MCP 未响应或认证未通过。'));};
    const request=http.request({host:endpoint.host,port:endpoint.port,path:'/mcp',method:'POST',agent:false,
      headers:{'content-type':'application/json','content-length':bytes.length,accept:'application/json, text/event-stream','mcp-method':method,'mcp-protocol-version':VERSION,...(method==='tools/call'?{'mcp-name':params.name}:{}),...(key?{[SERVICE_HEADER]:key}:{})}},response=>{
      response.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)request.destroy();else chunks.push(chunk);});
      response.on('error',fail);
      response.on('end',()=>{
        clearTimeout(timer);
        try { const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));resolve({status:response.statusCode,body}); }
        catch { fail(); }
      });
    });
    timer=setTimeout(()=>request.destroy(),timeout);request.on('error',fail);request.end(bytes);
  });
}
