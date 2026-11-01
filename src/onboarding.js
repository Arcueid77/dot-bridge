export const onboarding=Object.freeze({
  lark:{name:'飞书',console:'https://open.feishu.cn/',steps:['创建企业自建应用并开启机器人，把应用发布到本人可用范围。','按组件部署指南完成应用授权和本人私聊配对，保留配对文件与原存储密钥。'],credentials:['飞书配对文件'],guide:'dot-lark-bridge/docs/deployment.md'},
  qq:{name:'QQ',console:'https://q.qq.com/',steps:['使用官方机器人接入流程，并按组件 connect:qq 引导扫码确认本人。','保留已有应用和本人绑定；迁移前先停止旧消费者。'],credentials:['QQ 应用凭据和本人配对文件'],guide:'dot-qq-bridge/docs/deployment.md'},
  dingtalk:{name:'钉钉',console:'https://open.dingtalk.com/',steps:['企业内部应用 → 添加机器人 → Stream 模式 → 发布到本人可见范围。','停止旧消费者，将应用凭据保存为私有 app.json，运行组件的配对命令。','五分钟内从本人单聊发送完整临时口令；配对成功后把生成的 credentials.json 交给服务。'],credentials:['Client ID','Client Secret','配对生成的本人私聊绑定'],guide:'dot-dingtalk-bridge/docs/configuration.md'},
  wecom:{name:'企业微信',console:'https://work.weixin.qq.com/',steps:['智能机器人 → API 模式 → 长连接，取得此模式专用 Bot ID 和 Secret。','停止旧消费者，将 botId、secret 保存为私有 app.json，运行组件的配对命令。','五分钟内从本人单聊发送完整临时口令，生成绑定文件，无需手抄加密用户 ID。'],credentials:['Bot ID','长连接 Secret','配对生成的本人私聊绑定'],guide:'dot-wecom-bridge/docs/configuration.md'},
  weixin:{name:'微信 iLink',steps:['确认旧消费者已停止，在交互终端运行组件的 login.js 扫码命令。','用本人微信扫描临时二维码并确认；如手机提示验证码，只在终端隐藏输入。','登录成功后生成本人绑定文件；同一账号只运行一个消费者，登录失效后重新扫码。'],credentials:['扫码生成的 iLink 登录凭据和本人绑定'],guide:'dot-weixin-bridge/docs/setup.md'},
  discord:{name:'Discord',console:'https://discord.com/developers/applications',steps:['创建应用和 Bot，以 bot scope 安装到自己的服务器，再打开机器人私聊。','开启开发者模式，核对本人 User ID 和这个一对一私聊的 Channel ID。'],credentials:['Bot Token','本人 User ID','机器人 DM Channel ID'],guide:'dot-discord-bridge/README.md'},
  telegram:{name:'Telegram',console:'https://t.me/BotFather',steps:['在官方 BotFather 创建专用 Bot，Token 存入受保护文件。','确认原消费者已停止，使用组件配对命令生成一次性 /start 指令，由本人发送完成绑定。'],credentials:['Bot Token','经一次性配对确认的本人私聊绑定'],guide:'dot-telegram-bridge/README.md'},
  line:{name:'LINE',console:'https://manager.line.biz/',steps:['在 Official Account Manager 为自己的账号启用 Messaging API，并把账号加为好友。','从同一 channel 取得 Secret、Access Token 和本人 User ID。','准备公网 HTTPS webhook；Verify 成功后开启 Use webhook，核对自动回复设置。'],credentials:['Channel Secret','Channel Access Token','本人 User ID','同一 bot 的用户 ID'],guide:'dot-line-bridge/docs/setup.md'}
});

export function onboardingText(ids) {
  return ids.map(id=>{
    const item=onboarding[id];
    return `${item.name}\n${item.console?item.console+'\n':''}${item.steps.map((step,i)=>`${i+1}. ${step}`).join('\n')}\n私密交接：${item.credentials.join('、')}。\n组件说明：node_modules/${item.guide}\n原 dot 订阅：${id}.message.created，conversation=owner。\n附件：使用 get_${id}_attachment 读取支持的附件；回发原附件使用 reply_${id}_attachment，每条原消息只选择一个最终回复。`;
  }).join('\n\n')+'\n\nToken、Secret 和身份值只保存到私有配置。完成配置后运行 doctor，再检查 status；原 dot 建立有效订阅后，从本人私聊验收。\n';
}
