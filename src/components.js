import {fileURLToPath} from 'node:url';
import {larkAdapter} from 'dot-lark-bridge/adapter';
import {qqAdapter} from 'dot-qq-bridge/adapter';

export const components = Object.freeze({
  lark: Object.freeze({id:'lark', name:'飞书 / Lark', package:'dot-lark-bridge', adapter:larkAdapter,
    config:()=>import('dot-lark-bridge/config'),
    live:fileURLToPath(import.meta.resolve('dot-lark-bridge/runtime/live')),
    readiness:fileURLToPath(import.meta.resolve('dot-lark-bridge/runtime/readiness')),
    liveArgs:['--confirm-live-owner-bridge']}),
  qq: Object.freeze({id:'qq', name:'QQ 官方机器人', package:'dot-qq-bridge', adapter:qqAdapter,
    config:()=>import('dot-qq-bridge/config'),
    live:fileURLToPath(import.meta.resolve('dot-qq-bridge/runtime/live')),
    readiness:fileURLToPath(import.meta.resolve('dot-qq-bridge/runtime/readiness')),
    liveArgs:['--run','--confirm-persistent-service']})
});
export const channelIds = Object.freeze(Object.keys(components));
