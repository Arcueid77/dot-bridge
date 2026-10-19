import http from 'node:http';
import {VERSION,SERVICE_HEADER,metadata} from '@dot-bridge/core/router/common.js';
import {OperatorError} from './errors.js';
export function inspectMcp(endpoint,method='tools/list',{timeout=2000,key=endpoint.key}={}) {
  return new Promise((resolve,reject)=>{
    const bytes=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,method,params:{_meta:metadata()}}));
    let timer,size=0;const chunks=[];
    const fail=()=>{clearTimeout(timer);reject(new OperatorError('mcp_unavailable','本地 MCP 未响应或认证未通过。'));};
    const request=http.request({host:endpoint.host,port:endpoint.port,path:'/mcp',method:'POST',agent:false,
      headers:{'content-type':'application/json','content-length':bytes.length,accept:'application/json, text/event-stream','mcp-method':method,'mcp-protocol-version':VERSION,...(key?{[SERVICE_HEADER]:key}:{})}},response=>{
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
