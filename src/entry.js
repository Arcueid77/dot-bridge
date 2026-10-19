import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {startRouter} from '@dot-bridge/core/router/main.js';
import {components} from './components.js';
import {assertNode,readManifest,backendConfiguration,routerConfiguration,applyEnvironment} from './config.js';
try {
  assertNode();
  const {values}=parseArgs({options:{config:{type:'string'},component:{type:'string'},'confirm-live':{type:'boolean'},supervised:{type:'boolean'}}});
  if(!values.config)throw Error();
  const manifest=readManifest(values.config),id=values.component;
  if((manifest.mode==='live')!==Boolean(values['confirm-live']))throw Error();
  if(id==='router'){
    const router=routerConfiguration(manifest);applyEnvironment(router.env,values.supervised);
    process.argv=[process.execPath,process.argv[1],...(manifest.mode==='live'?['--confirm-live']:[])];
    await startRouter(manifest.selected.map(key=>components[key].adapter));
  }else{
    if(!manifest.selected.includes(id))throw Error();
    const backend=await backendConfiguration(manifest,id);applyEnvironment(backend.env,values.supervised);
    const entry=components[id][manifest.mode];
    process.argv=[process.execPath,entry,...(manifest.mode==='live'?components[id].liveArgs:[])];
    await import(pathToFileURL(entry).href);
  }
}catch{
  process.stderr.write('Component startup refused; no private values printed.\n');process.exitCode=1;
}
