import {fileURLToPath} from 'node:url';
import {larkAdapter} from 'dot-lark-bridge/adapter';
import {qqAdapter} from 'dot-qq-bridge/adapter';
import dingtalkAdapter from 'dot-dingtalk-bridge/adapter';
import wecomAdapter from 'dot-wecom-bridge/adapter';
import weixinAdapter from 'dot-weixin-bridge/adapter';
import discordAdapter from 'dot-discord-bridge/adapter';
import telegramAdapter from 'dot-telegram-bridge/adapter';
import lineAdapter from 'dot-line-bridge/adapter';

const channel=(id,name,pkg,adapter,config,live,readiness)=>Object.freeze({id,name,package:pkg,adapter,config,live:fileURLToPath(live),readiness:fileURLToPath(readiness),liveArgs:['--confirm-live']});

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
    liveArgs:['--run','--confirm-persistent-service']}),
  dingtalk:channel('dingtalk','钉钉','dot-dingtalk-bridge',dingtalkAdapter,()=>import('dot-dingtalk-bridge/config'),import.meta.resolve('dot-dingtalk-bridge/runtime/live'),import.meta.resolve('dot-dingtalk-bridge/runtime/readiness')),
  wecom:channel('wecom','企业微信','dot-wecom-bridge',wecomAdapter,()=>import('dot-wecom-bridge/config'),import.meta.resolve('dot-wecom-bridge/runtime/live'),import.meta.resolve('dot-wecom-bridge/runtime/readiness')),
  weixin:channel('weixin','微信 iLink','dot-weixin-bridge',weixinAdapter,()=>import('dot-weixin-bridge/config'),import.meta.resolve('dot-weixin-bridge/runtime/live'),import.meta.resolve('dot-weixin-bridge/runtime/readiness')),
  discord:channel('discord','Discord','dot-discord-bridge',discordAdapter,()=>import('dot-discord-bridge/config'),import.meta.resolve('dot-discord-bridge/runtime/live'),import.meta.resolve('dot-discord-bridge/runtime/readiness')),
  telegram:channel('telegram','Telegram','dot-telegram-bridge',telegramAdapter,()=>import('dot-telegram-bridge/config'),import.meta.resolve('dot-telegram-bridge/runtime/live'),import.meta.resolve('dot-telegram-bridge/runtime/readiness')),
  line:channel('line','LINE','dot-line-bridge',lineAdapter,()=>import('dot-line-bridge/config'),import.meta.resolve('dot-line-bridge/runtime/live'),import.meta.resolve('dot-line-bridge/runtime/readiness'))
});
export const channelIds = Object.freeze(Object.keys(components));
