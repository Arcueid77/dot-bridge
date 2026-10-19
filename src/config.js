import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {readPrivateFile} from '@dot-bridge/core/platform/private-files.js';
import {existingWindowsPython} from '@dot-bridge/core/platform';
import {readServiceKey} from '@dot-bridge/core/router/auth.js';
import {readConfig as readRouterConfig} from '@dot-bridge/core/router/config.js';
import {components, channelIds} from './components.js';
import {refuse} from './errors.js';

const bad=()=>refuse('configuration_invalid','配置格式不正确，请参考 examples/bridge.example.json。');
function fields(value, allowed, required=allowed) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))bad();
}
function absolute(value) {
  if(typeof value!=='string'||!path.isAbsolute(value)||path.normalize(value)!==value||/[\x00-\x1f\x7f]/.test(value))bad();
  return value;
}
export function assertNode() {
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major!==24||minor<15)refuse('node_version','需要 Node.js >=24.15 且 <25。');
}
export function validateManifest(value, file) {
  fields(value,['version','mode','channels','routerEnv','dataDirectory','systemd'],['version','mode','channels','routerEnv','dataDirectory']);
  if(value.version!==1||!['readiness','live'].includes(value.mode))bad();
  fields(value.channels,channelIds,[]);
  const selected=Object.keys(value.channels).sort();if(!selected.length)bad();
  for(const id of selected)absolute(value.channels[id]);
  absolute(value.routerEnv);absolute(value.dataDirectory);
  const all=[value.routerEnv,...Object.values(value.channels)];if(new Set(all).size!==all.length)bad();
  const service=value.systemd??{prefix:'dot-bridge',user:'dot-bridge'};
  fields(service,['prefix','user','tunnelUnit'],['prefix','user']);
  if(!/^dot-bridge(?:-[a-z0-9-]{1,24})?$/.test(service.prefix)||!/^\b[a-z_][a-z0-9_-]{0,31}$/.test(service.user)||service.user==='root')bad();
  if(service.tunnelUnit!==undefined&&!/^dot-bridge(?:-[a-z0-9-]{1,40})?-tunnel\.service$/.test(service.tunnelUnit))bad();
  if(service.tunnelUnit===`${service.prefix}-router.service`)bad();
  return Object.freeze({...value,channels:Object.freeze({...value.channels}),selected:Object.freeze(selected),systemd:Object.freeze({...service}),file:absolute(file)});
}
export function readManifest(file) {
  const resolved=path.resolve(file);let fd;
  try {
    const stat=fs.lstatSync(resolved), actual=fs.realpathSync(resolved);
    const same=process.platform==='win32'?actual.toLowerCase()===resolved.toLowerCase():actual===resolved;
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>65536||!same)bad();
    fd=fs.openSync(resolved,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
    const bytes=Buffer.alloc(65537), length=fs.readSync(fd,bytes,0,bytes.length,0);
    if(length>65536)bad();
    return validateManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,length))),resolved);
  } catch(error) {
    if(error?.code==='configuration_invalid')throw error;
    refuse('manifest_unavailable','无法读取配置清单；文件应为有效 JSON，且不能使用链接。');
  } finally { if(fd!==undefined)fs.closeSync(fd); }
}
export function readEnvironment(file) {
  if(process.platform==='win32') {
    try {existingWindowsPython();}
    catch {refuse('python_required','Windows 私有文件检查需要已有的 Python 3；请把 DOT_BRIDGE_PYTHON 设置为 python.exe 的绝对路径。');}
  }
  let bytes;
  try {
    bytes=readPrivateFile(file,{maxBytes:65536});
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(text.includes('\0'))throw Error();
    const names=[...text.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map(m=>m[1]);
    if(new Set(names).size!==names.length)throw Error();
    const env=parseEnv(text);
    for(const name of Object.keys(env))if(/^(NODE_|LD_|DYLD_)/i.test(name)||name.toUpperCase()==='DOT_BRIDGE_SUPERVISED')throw Error();
    return env;
  } catch { refuse('environment_unsafe','环境文件不可读或不安全；请检查属主、私有权限、链接及重复字段。'); }
  finally { bytes?.fill(0); }
}
function baseMode(env, mode) {
  if(env.AUTH_MODE!=='tunnel-service'||env.BRIDGE_MODE!=='tunnel'||(env.TUNNEL_SERVICE_OPERATION??'readiness')!==mode)refuse('mode_mismatch','清单和环境文件必须使用相同的 Tunnel 运行模式。');
  if((env.HOST??'127.0.0.1')!=='127.0.0.1')refuse('listener_invalid','总发行版只接受 127.0.0.1 上的 MCP 监听地址。');
}
export async function backendConfiguration(manifest,id,env=readEnvironment(manifest.channels[id])) {
  if(!manifest.selected.includes(id))bad();
  baseMode(env,manifest.mode);
  try {
    const module=await components[id].config();
    const config=id==='lark'&&manifest.mode==='readiness'?module.readTunnelReadinessConfig(env):module.readConfig(env);
    if(manifest.mode==='readiness') {
      if(['DATABASE_PATH','STORAGE_KEY','STORAGE_KEY_FILE',id==='lark'?'LARK_CREDENTIALS_FILE':'QQ_CREDENTIALS_FILE'].some(k=>env[k]))throw Error();
    } else {
      const state=path.join(manifest.dataDirectory,id), relative=path.relative(state,config.dbPath);
      if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)||env.BRIDGE_LOCK_DIRECTORY!==path.join(manifest.dataDirectory,'locks'))throw Error();
    }
    return {id,env,config,host:config.host,port:config.port,keyFile:config.tunnelServiceKeyFile};
  } catch { refuse('backend_configuration',`${id} 配置未通过组件检查，请核对其接入文档和私有目录。`); }
}
export function routerConfiguration(manifest, supplied) {
  const env=readEnvironment(manifest.routerEnv);baseMode(env,manifest.mode);
  // The manifest selects channels. Route ports and key references come from each
  // selected backend's protected configuration, never from network input.
  for(const id of channelIds){const prefix=components[id].adapter.envPrefix;delete env[`${prefix}_MCP_PORT`];delete env[`${prefix}_SERVICE_KEY_FILE`];}
  env.TUNNEL_CHANNELS=manifest.selected.join(',');
  env.TUNNEL_LIVE_CHANNELS=manifest.mode==='live'?env.TUNNEL_CHANNELS:'';
  for(const id of manifest.selected){
    const backend=supplied?.[id]?.env??readEnvironment(manifest.channels[id]);baseMode(backend,manifest.mode);
    const prefix=components[id].adapter.envPrefix;
    env[`${prefix}_MCP_PORT`]=backend.PORT??'3000';
    env[`${prefix}_SERVICE_KEY_FILE`]=backend.TUNNEL_SERVICE_KEY_FILE;
  }
  try {
    const config=readRouterConfig(env,manifest.selected.map(id=>components[id].adapter));
    return {id:'router',env,config,host:config.host,port:config.port,keyFile:config.ingressKeyFile};
  } catch { refuse('router_configuration','聚合路由配置无效，请检查端口和独立 service key 文件。'); }
}
export async function prepare(manifest) {
  assertNode();const backends={};
  for(const id of manifest.selected)backends[id]=await backendConfiguration(manifest,id);
  const router=routerConfiguration(manifest,backends), all=[...Object.values(backends),router];
  for(const id of manifest.selected)if(router.config.channels[id].port!==backends[id].port)refuse('port_mismatch','聚合路由与 IM 端口不一致。');
  const keys=[];
  for(const item of all) {
    try { item.key=readServiceKey(item.keyFile,true);keys.push(item.key); }
    catch { refuse('service_key_unsafe','Service key 文件未通过权限或格式检查。'); }
  }
  if(new Set(keys).size!==keys.length)refuse('service_keys_reused','聚合入口与每个 IM 必须使用独立的 service key。');
  return {manifest,backends,router};
}
export function processEnvironment(extra={}) {
  const allowed=['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','LANG','LC_ALL','PYTHONUTF8','DOT_BRIDGE_PYTHON','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'];
  return {...Object.fromEntries(allowed.filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]])),...extra};
}
export function applyEnvironment(env,supervised=false) {
  const replacement=processEnvironment(env);
  for(const key of Object.keys(process.env))delete process.env[key];
  Object.assign(process.env,replacement);
  if(supervised)process.env.DOT_BRIDGE_SUPERVISED='1';
}
