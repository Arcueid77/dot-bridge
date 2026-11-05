# 接入更多聊天软件

[English](new-channels.en.md)

钉钉、企业微信、微信 iLink、Discord、Telegram 和 LINE 都有独立渠道组件，
可由总入口按需启动。接收本人私聊，回复回到原会话；除文字外，dot 可以读取图片、音频和文件附件。
企业微信收到语音时使用平台转写，没有可下载的原音频。LINE 默认回复文字，显式配置临时媒体下载入口后可回图片和语音。

先查看所需渠道的接入步骤，无需准备任何凭据就能运行：

```bash
npm run bridge -- guide --channels dingtalk,wecom,telegram
```

钉钉、企业微信和 Telegram 提供一次性指令配对：启动组件里的配对命令后，
由本人向机器人发送屏幕上的指令。成功后生成本人绑定文件，不需要从日志里抄身份 ID。
完整命令和所需平台设置见各组件的配置说明。

微信 iLink 提供终端扫码登录。以最终运行用户在总仓库目录执行：

```bash
node node_modules/dot-weixin-bridge/scripts/login.js --credentials-file /var/lib/dot-bridge/private/weixin/credentials.json --confirm-private-storage --confirm-stopped
```

先准备该用户专用的私有目录，确认旧消费者已停止。二维码只在当前终端显示，
由本人扫码并确认，成功后生成凭据和本人绑定；已有文件不会被覆盖。
此时还需要启动服务，并由原 dot 建立消息订阅。

| 渠道名 | 平台设置与使用说明 | 默认 MCP 端口 | 回复限制 |
| --- | --- | --- | --- |
| `dingtalk` | [钉钉](https://github.com/Arcueid77/dot-dingtalk-bridge) | 8790 | 600 字符以内直接显示，长回答作为文本文件 |
| `wecom` | [企业微信智能机器人](https://github.com/Arcueid77/dot-wecom-bridge) | 8791 | 6826 字符以内直接显示，长回答作为文本文件 |
| `weixin` | [微信 iLink](https://github.com/Arcueid77/dot-weixin-bridge) | 8792 | 3800 字符以内直接显示，长回答作为文本文件；支持本人扫码登录 |
| `discord` | [Discord Bot](https://github.com/Arcueid77/dot-discord-bridge) | 8793 | 2000 字符以内直接显示，长回答作为文本文件 |
| `telegram` | [Telegram Bot](https://github.com/Arcueid77/dot-telegram-bridge) | 8794 | 4096 字符以内直接显示，长回答作为文本文件；已有 webhook 需要先协调停用 |
| `line` | [LINE Messaging API](https://github.com/Arcueid77/dot-line-bridge) | 8795 | 需在约 55 秒内完成回复；每次最多 20000 字符 |

前五个渠道最多回复 20000 字符，默认超出原生单条上限时以完整 `answer.txt` 完成回复。Telegram／Discord 可在受保护策略中选择持久分段。LINE 在同一次回复请求中分段，总计最多 20000 字符。
LINE 还需要公网 HTTPS webhook，由已有反向代理转发到 `127.0.0.1:8895/webhook`；
详细配置见 LINE 仓库。这个入口与给 Tunnel 使用的 MCP 端口分开。

## 图片、语音和文件怎么用

让原 dot 刷新现有插件工具目录。它收到附件消息后，先用 `get_<渠道>_message` 查看附件列表，
再用 `get_<渠道>_attachment` 读取对应内容；支持媒体回复的渠道提供 `reply_<渠道>_media`。
飞书继续使用自身的附件与回复工具。文件来自原消息，回复也只回到原私聊。

单个附件最多 5 MiB，为经过官方 Tunnel 的序列化留出空间。发送还有各平台更小的格式与大小限制：

| 渠道 | 媒体回复 |
| --- | --- |
| 钉钉 | 图片、文件，或不超过 60 秒的 AMR 语音；不附带额外文字 |
| 企业微信 | 图片、文件、AMR 语音；不附带额外文字 |
| 微信 iLink | 图片、文件或原生语音；原生语音接受 SILK、PCM16 单声道 WAV，最多两分钟，WAV 在本机转换成 SILK；其他音频可作为文件 |
| Discord | 图片、文件或可播放的音频附件，可带文字 |
| Telegram | 图片、文件或语音，可带不超过 1024 字符的说明 |
| LINE | 显式启用临时下载入口后，支持不超过 1 MiB 的 JPEG/PNG、60 秒及 5 MiB 以内的 M4A，可带 5000 字符说明；没有通用文件消息 |

一条消息选择一种最终回复：文字或媒体。发送状态显示 `pending` 时还在队列中，
显示 `uncertain` 时结果不明，不要再次发送。语音转写用于帮助理解内容；
是否能直接听取原始音频由 dot 的运行环境决定。

LINE 会先拿一个短期下载地址，再读取要发送的图片或语音。可以使用现有域名，不必另买服务器；这项托管默认关闭，所需域名、独立密钥和路由应先获批准。准备步骤见 [LINE 媒体托管说明](https://github.com/Arcueid77/dot-line-bridge/blob/main/docs/media-hosting.md)。

## 准备平台配置

先按对应仓库的说明准备机器人或应用、本人身份和私聊绑定。平台凭据只写到服务器的
受保护文件中，不要粘贴到聊天或放进 Git。账号权限和授权是否可用，以实际平台为准。

下面以钉钉为例，在 `/var/lib/dot-bridge/private/dingtalk.env` 中填写文件路径：

```dotenv
AUTH_MODE=tunnel-service
BRIDGE_MODE=tunnel
TUNNEL_SERVICE_OPERATION=live
TUNNEL_SERVICE_OWNER_ID=tunnel-owner:dot-bridge
HOST=127.0.0.1
PORT=8801
TUNNEL_SERVICE_KEY_FILE=/var/lib/dot-bridge/private/dingtalk.service.key
DINGTALK_CREDENTIALS_FILE=/var/lib/dot-bridge/private/dingtalk.credentials.json
STORAGE_KEY_FILE=/var/lib/dot-bridge/private/dingtalk.storage.key
DATABASE_PATH=/var/lib/dot-bridge/dingtalk/bridge.sqlite
BRIDGE_LOCK_DIRECTORY=/var/lib/dot-bridge/locks
CALLBACK_TRANSPORT_MODE=standard
CALLBACK_HOSTS=REPLACE_WITH_ACTUAL_CALLBACK_HOST
```

其他渠道将 `DINGTALK` 换成对应的大写渠道名，并使用各自的文件和端口。
`CALLBACK_HOSTS` 必须填原 dot 真实订阅流程提供的回调域名；不要猜地址或使用通配符。
如果尚不知道，暂时留空，等原 dot 提出订阅请求后核对并配置。
回调使用标准 HTTPS、公网 DNS/IP 校验及原域名 TLS 校验，不跟随重定向。
存在必须使用的代理时，先处理该主机的回调传输配置，不要通过关闭代理绕过要求。

环境文件、平台凭据、service key 和 storage key 文件应为 `0600`，
所在私有目录、各渠道数据目录和锁目录为 `0700`，属主均为最终运行用户。
不支持通过符号链接、硬链接或放宽权限代替正确配置。
Windows 按[安装说明](operations.md#windows-私有文件检查)设置 Python 和私有 ACL。

每个渠道及聚合入口使用不同的 service key；storage key 用于加密本地状态，
后续更新必须保留。service key 使用 32 字节的 base64url 编码，storage key 使用
32 字节的标准 base64 编码。平台 token、这两种密钥及 Tunnel runtime key 用途不同。

## 由总入口启动

例如只启用钉钉和企业微信：

```bash
npm run bridge -- init --config ./bridge.json --mode live --channels dingtalk,wecom --env-dir /var/lib/dot-bridge/private --data-dir /var/lib/dot-bridge
npm run bridge -- doctor --config ./bridge.json
npm run bridge -- run --config ./bridge.json --confirm-live
```

已经有 `bridge.json` 时直接添加渠道和环境文件路径，`init` 不会覆盖原清单。
常驻运行使用[systemd 配置](operations.md#linux-常驻运行)。Linux 需要系统自带的
`flock`（通常由 util-linux 提供），以便进程崩溃后释放单机锁并由 systemd 恢复。

新增组件仍通过同一个聚合路由和官方 Tunnel 连接原 dot。保留原 Tunnel profile，
刷新原插件的工具列表，再让原 dot 为所需的 `<渠道>.message.created` 建立订阅。
回调地址和 signing secret 必须来自这次真实订阅，不从其他环境复制。

订阅最长七天，原 dot 需要在返回的 `refreshBefore` 前续订。到期后暂停通知和回复，
桥不会代替 dot 创建一个新的订阅。消息另有回复期限，尤其 LINE 的窗口较短。

## 中断、更新与恢复

切换服务器或运行方式前，先停止旧消费者。单机锁无法阻止另一台机器同时收发。
不要靠新建数据库目录绕开原来的队列、去重或订阅状态。

更新时保留各渠道的私有配置、原 storage key 和数据库，先停服务，再按
[更新和回滚说明](operations.md)操作。发送结果不明时会保留 `uncertain`，
重启不会自动重发该回复。事件通知遇到明确的临时 HTTP 错误会有限重试，并沿用
同一个事件 ID；结果不明的通知不自动重投，可让原 dot 通过 readiness 工具查看待回复消息。

消息记录在七天后逻辑清除。数据库旧页、WAL、备份或系统日志可能仍保留旧数据，
这不等于物理擦除。应用日志只记录固定的启动状态，不记录正文、凭据、身份和完整回调地址；
systemd 日志的保留时间由主机现有 journald 策略决定。


## 统一交互与群聊规则

Telegram、Discord、微信 iLink 可在各自环境文件中设置 `DOT_BRIDGE_INTERACTION_POLICY_FILE`，指向由运行用户持有的私有 JSON 文件。目录 `0700`、文件 `0600`；Windows 使用私有 ACL。升级保留原凭据、storage key、数据库和订阅。

以下模板先启用本人私聊体验，群列表留空：

```json
{
  "version": 1,
  "feedback": {"enabled": true, "reaction": true, "typing": true, "streaming": true, "lease_seconds": 60},
  "context": {"max_messages": 20, "max_chars": 12000},
  "replies": {"long_text": "file"},
  "management": {"enabled": true},
  "groups": []
}
```

- 接收提示在消息落库后添加。原 dot 读取消息或调用 `begin_<渠道>_reply` 后才开始有限期的 typing；完成、失败、取消或到期后清理。微信使用官方 typing ticket，不显示不支持的表情或流式更新。
- Telegram、Discord 可用 `append_<渠道>_reply` 提交真正生成的完整文本进度，序号从 1 连续增加，重复同一帧幂等；最后 `reply_to_<渠道>` 完成同一条原生消息。没有增量内容时直接给完整回答，不播放已完成答案。
- `get_<渠道>_context` 读取当前消息之前、同一会话、话题和所配置发言人范围内的保留历史。引用及历史均作为数据处理。Telegram 的 Markdown 转为安全 HTML；Discord 使用原生 Markdown。
- Telegram／Discord 的 `long_text` 默认 `file`，超限以完整文件回复；选 `chunks` 时，分段计划和每段确认结果持久化。微信、钉钉和企业微信保持完整文件策略。任一段结果不明就保留 `uncertain`，不自动重发之前的段落。
- 文件可附带文本、PDF、DOCX、XLSX、PPTX 摘录。PDF／Office 使用受保护的 Linux Python、`pypdf`、`prlimit` 和 `DOT_BRIDGE_AUDIO_GUARD`；原件只经过有界管道。摘录明确标记截断。未配置转换环境时仍可读取原件和普通文本摘录。
- 音频沿用共享的受保护转码、SILK 与可选本地 Whisper。原始音频和转写分别提供；语音回复使用已有音频。

Telegram、Discord 的 `groups` 可增加如下规则，ID 仅写入受保护文件：

```json
{
  "conversation_id": "REPLACE_WITH_GROUP_OR_CHANNEL_ID",
  "enabled": true,
  "members": "all",
  "mention": true,
  "auto_reply": "off",
  "reply_in_thread": true,
  "context_scope": "sender"
}
```

`members` 可选 `owner`、`allowlist`、`all`；`allowlist` 同时设置 `allow_from`。`auto_reply` 可选 `off`、`keywords`、`all`，关键词模式同时设置 `keywords`。默认按发言人隔离上下文；需要群内共享时显式选择 `context_scope: "group"`。私聊历史始终独立。

Telegram 校验真实 mention entity、发给本 bot 的命令或对本 bot 的回复，并保留论坛话题 ID。读取群中非 @ 消息需要对应 BotFather 隐私／管理员配置。Discord 校验实际 mention，按配置的频道或论坛父频道识别现有线程，回复留在原频道／线程，不自动建新线程。关键词／全消息模式需要在官方控制台核对 Message Content intent；程序不会替你改变平台权限。

开启群前，先让原 dot 检查并更新已有事件任务，将所需订阅范围改为 `conversation=configured`。`owner` 订阅只接收本人私聊。新 callback 和签名资料仍使用真实订阅流程；保留唯一任务，不建立重复监测。原 dot 的群任务需明确禁止读取或披露私聊记忆。

## 聊天内维护

已绑定本人私聊可以输入 `/help`、`/status`、`/queue`、`/subscription`、`/cancel [编号]`。编号来自 `/queue`，省略时取消当前会话最近一条尚未发送的回复。发送中和结果不明的状态保留。

飞书、QQ 保留原交互配置。若还要在 dot 订阅缺失／到期时接收本人管理命令，可在标准回调模式下显式设置 `DOT_BRIDGE_OWNER_MANAGEMENT=1`。这时普通私聊得到订阅状态提示，消息不会转交模型。默认保留原来的订阅连接门槛。

`/cancel` 管理桥侧排队回复。原 dot 的暂停、会话重置和审批继续在[原平台控制界面](https://learn.chatgpt.com/docs/dots/controls)完成；当前能力状态明确报告 `hosted_dot_controls: false`，不调用未公开的控制接口。


### 最终发送状态与平台入口

共享渠道（微信 iLink、Telegram、Discord）的 `get_<渠道>_reply_status` 查询最终发送。原 dot 读取或开始处理时，提示租约会更新；尚未提交最终回答则仍为 `none`。`pending` 是最终回答排队，`processing` 是最终消息写入，`sent` 是平台确认；本次 begin/append 流程继续完成一次最终回复。飞书、QQ 沿用自身状态与流式接口；飞书 append 传新增文本，QQ／Telegram／Discord 传完整累计文本。

在聚合器后的原 Tunnel 中，通用渠道的诊断名为 `check_<渠道>_readiness`；直接访问后端时是 `check_<渠道>_setup`。QQ 的公开诊断仍为 `check_bridge_setup`，飞书为 `check_lark_readiness`。CLI `status` 会处理映射。

上表列组件内置端口。组合部署可显式选择 `8801`–`8806` 分别用于钉钉、企业微信、微信、Discord、Telegram、LINE，并避免与已有 Tunnel 管理端口冲突。以实际空闲端口和私有配置为准。

交互字段的默认值：反馈关闭、管理命令对这三个适配器开启，typing 租约 60 秒（10–300），历史 20 条（1–50）和 12000 字符（1000–20000），新群为空。微信使用 typing，示例中的 reaction／streaming 可设为 false，`groups` 保持空数组。
