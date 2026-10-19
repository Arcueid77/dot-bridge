import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {refuse} from './errors.js';

const escape=(value,dollars=false)=>{if(/[\x00-\x1f\x7f]/.test(value))refuse('unit_argument','服务路径含有无效字符。');let text=value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('%','%%');if(dollars)text=text.replaceAll('$','$$');return '"'+text+'"';};
export function renderUnits(manifest,{node=process.execPath,entry=fileURLToPath(new URL('./entry.js',import.meta.url))}={}) {
  const {prefix,user,tunnelUnit}=manifest.systemd;
  const ids=[...manifest.selected,'router'],units={};
  for(const id of ids){
    const dependencies=id==='router'?manifest.selected.map(channel=>`${prefix}-${channel}.service`):['network-online.target'];
    const writable=id==='router'?[]:[path.join(manifest.dataDirectory,id),path.join(manifest.dataDirectory,'locks')];
    const command=[node,entry,'--config',manifest.file,'--component',id,...(manifest.mode==='live'?['--confirm-live']:[])].map(value=>escape(value,true)).join(' ');
    units[`${prefix}-${id}.service`]=`[Unit]\nDescription=DotBridge ${id}\nPartOf=${prefix}.target\nWants=${dependencies.join(' ')}\nAfter=${dependencies.join(' ')}\n\n[Service]\nType=simple\nUser=${user}\nGroup=${user}\nWorkingDirectory=${escape(path.dirname(entry))}\nExecStart=${command}\nRestart=on-failure\nRestartSec=5s\nTimeoutStopSec=180s\nKillMode=control-group\nUMask=0077\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\n${writable.length?'ReadWritePaths='+writable.map(value=>escape(value)).join(' ')+'\n':''}StandardOutput=journal\nStandardError=journal\n`;
  }
  const wanted=[...ids.map(id=>`${prefix}-${id}.service`),...(tunnelUnit?[tunnelUnit]:[])];
  units[`${prefix}.target`]=`[Unit]\nDescription=DotBridge selected IM channels\nWants=${wanted.join(' ')}\nAfter=${prefix}-router.service\n\n[Install]\nWantedBy=multi-user.target\n`;
  return units;
}
export function writeUnits(manifest,output) {
  if(process.platform!=='linux')refuse('linux_required','systemd 服务文件请在最终 Linux 主机上生成。');
  const target=path.resolve(output);
  if(fs.existsSync(target))refuse('output_exists','服务输出目录已存在，请选择一个新的目录以保留原文件。');
  const parent=path.dirname(target);
  if(fs.realpathSync(parent)!==parent)refuse('output_unsafe','服务输出目录的父路径不能含链接。');
  const units=renderUnits(manifest);fs.mkdirSync(target,{mode:0o700});
  for(const [name,content] of Object.entries(units))fs.writeFileSync(path.join(target,name),content,{flag:'wx',mode:0o600});
  return Object.keys(units);
}
export function serviceAction(manifest,action) {
  if(process.platform!=='linux')refuse('linux_required','常驻服务管理需要 Linux/systemd；本机可使用 run 前台启动。');
  if(!['start','stop','restart','status'].includes(action))refuse('service_action','服务操作只能是 start、stop、restart 或 status。');
  const target=`${manifest.systemd.prefix}.target`;
  const args=action==='status'?['show',target,...[...manifest.selected,'router'].map(id=>`${manifest.systemd.prefix}-${id}.service`),'--property=Id,LoadState,ActiveState,SubState,MainPID,NRestarts']: [action,target];
  const result=spawnSync('systemctl',args,{encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:65536});
  if(result.status!==0)refuse('service_failed','systemd 操作未完成；请检查服务是否安装以及当前用户的管理权限。');
  return action==='status'?result.stdout.trim():`${action}: ${target}`;
}
