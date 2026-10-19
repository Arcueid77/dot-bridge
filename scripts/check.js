import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'components.lock.json'),'utf8'));
if(manifest.schemaVersion!==1||Object.keys(manifest.components).sort().join(',')!=='core,lark,qq')throw Error('Unexpected component manifest.');
for(const [id,item] of Object.entries(manifest.components)){
 if(!/^[a-f0-9]{40}$/.test(item.revision)||!/^vendor\/dot-[a-z-]+-[0-9.]+\.tgz$/.test(item.artifact))throw Error('Invalid artifact reference.');
 const bytes=fs.readFileSync(path.join(root,item.artifact));
 if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Artifact checksum differs.');
 const integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');
 if(pkg.dependencies[item.package]!=='file:'+item.artifact||lock.packages[`node_modules/${item.package}`]?.integrity!==integrity)throw Error('npm resolution differs from the release manifest.');
 const installed=JSON.parse(fs.readFileSync(path.join(root,'node_modules',item.package,'package.json'),'utf8'));
 if(installed.version!==item.version)throw Error('Installed version differs.');
 if(id!=='core'){
  const release=JSON.parse(fs.readFileSync(path.join(root,'node_modules',item.package,'vendor/core-release.json'),'utf8'));
  if(release.source_revision!==manifest.components.core.revision||release.sha256!==manifest.components.core.sha256)throw Error('Channel core release differs.');
 }
}
for(const [name,item] of Object.entries(lock.packages))if(name.endsWith('node_modules/@dot-bridge/core')&&item.version!==manifest.components.core.version)throw Error('Multiple core versions installed.');
let count=0;
for(const folder of ['bin','src','scripts','test'])for(const file of fs.readdirSync(path.join(root,folder),{recursive:true}).filter(name=>/\.(js|mjs)$/.test(name))){
 const result=spawnSync(process.execPath,['--check',path.join(root,folder,file)],{encoding:'utf8',windowsHide:true});
 if(result.status!==0){process.stderr.write(result.stderr);process.exit(1);}count++;
}
for(const file of ['README.md','README.en.md','docs/development.md','docs/im-roadmap.md'])if(!fs.existsSync(path.join(root,file)))throw Error('Required documentation is missing.');
console.log(`Checked ${count} JavaScript files, pinned artifacts, installed versions and required documentation.`);
