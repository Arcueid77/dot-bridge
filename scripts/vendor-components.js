import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const root=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{sources:{type:'string'},'npm-cli':{type:'string'}}});
const sources=path.resolve(values.sources??path.join(root,'..'));
const npm=values['npm-cli']??process.env.npm_execpath;
if(!npm||!path.isAbsolute(npm)||!fs.existsSync(npm))throw Error('Run through npm run vendor or supply --npm-cli.');
const run=(command,args,cwd)=>{const r=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:1024*1024});if(r.status!==0)throw Error(`Component packaging failed at ${path.basename(command)}.`);return r.stdout.trim();};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'dot-bridge-package-'));
try{
 const manifest={schemaVersion:1,components:{}};
 fs.mkdirSync(path.join(root,'vendor'),{recursive:true});
 for(const [id,name] of [['core','dot-bridge-core'],['lark','dot-lark-bridge'],['qq','dot-qq-bridge'],...['dingtalk','wecom','weixin','discord','telegram','line'].map(id=>[id,`dot-${id}-bridge`])]){
  const source=path.join(sources,name);
  if(run('git',['status','--porcelain'],source))throw Error(`${name} must be a clean committed source checkout.`);
  const revision=run('git',['rev-parse','HEAD'],source);
  if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Invalid source revision.');
  const destination=path.join(scratch,name);fs.mkdirSync(destination);
  const archive=path.join(scratch,`${name}.tar`);
  run('git',['archive','--format=tar','--output',archive,revision],source);
  run('tar',['-xf',archive,'-C',destination],scratch);
  const metadata=JSON.parse(fs.readFileSync(path.join(destination,'package.json'),'utf8'));
  if(metadata.name!==(id==='core'?'@dot-bridge/core':name))throw Error('Component package name differs.');
  if(id!=='core'){
   const bundled=JSON.parse(fs.readFileSync(path.join(destination,'vendor/core-release.json'),'utf8'));
   const core=manifest.components.core;
   if(bundled.source_revision!==core.revision||bundled.version!==core.version||bundled.sha256!==core.sha256)throw Error(`${name} must consume the same reviewed core release.`);
  }
  const [packed]=JSON.parse(run(process.execPath,[npm,'pack','--ignore-scripts','--json'],destination));
  if(!/^dot-(bridge-core|(?:lark|qq|dingtalk|wecom|weixin|discord|telegram|line)-bridge)-[0-9.]+\.tgz$/.test(packed.filename))throw Error('Unexpected artifact name.');
  const bytes=fs.readFileSync(path.join(destination,packed.filename));
  fs.writeFileSync(path.join(root,'vendor',packed.filename),bytes);
  manifest.components[id]={package:metadata.name,version:metadata.version,repository:`https://github.com/Arcueid77/${name}`,revision,artifact:`vendor/${packed.filename}`,sha256:hash(bytes)};
 }
 fs.writeFileSync(path.join(root,'components.lock.json'),JSON.stringify(manifest,null,2)+'\n');
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 for(const item of Object.values(manifest.components))pkg.dependencies[item.package]='file:'+item.artifact;
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 console.log('Packed committed component releases; regenerate package-lock.json before publishing.');
}finally{
 const resolved=fs.realpathSync(scratch),parent=fs.realpathSync(os.tmpdir());
 if(path.dirname(resolved)!==parent||!path.basename(resolved).startsWith('dot-bridge-package-'))throw Error('Temporary cleanup boundary mismatch.');
 fs.rmSync(resolved,{recursive:true,force:true});
}
