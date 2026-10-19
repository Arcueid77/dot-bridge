# 接入更多聊天软件

钉钉、企业微信、微信 iLink、Discord、Telegram 和 LINE 都有独立渠道组件，
可由总入口按需启动。首版接收本人私聊，回复回到原会话；支持文字，附件只显示类型信息。
图片、文件和音频的内容读取尚未接入这些新渠道。平台已经附带的语音文字可以作为参考。

| 渠道名 | 平台设置与使用说明 | 默认 MCP 端口 | 回复限制 |
| --- | --- | --- | --- |
| `dingtalk` | [钉钉](https://github.com/Arcueid77/dot-dingtalk-bridge) | 8790 | 当前每次最多 600 字符 |
| `wecom` | [企业微信智能机器人](https://github.com/Arcueid77/dot-wecom-bridge) | 8791 | 当前每次最多 6826 字符 |
| `weixin` | [微信 iLink](https://github.com/Arcueid77/dot-weixin-bridge) | 8792 | 当前每次最多 3800 字符；需要已有 iLink 登录凭据 |
| `discord` | [Discord Bot](https://github.com/Arcueid77/dot-discord-bridge) | 8793 | 每次最多 2000 字符 |
| `telegram` | [Telegram Bot](https://github.com/Arcueid77/dot-telegram-bridge) | 8794 | 每次最多 4096 字符；已有 webhook 需要先协调停用 |
| `line` | [LINE Messaging API](https://github.com/Arcueid77/dot-line-bridge) | 8795 | 需在约 55 秒内完成回复；每次最多 20000 字符 |

以上是组件的当前上限。超过上限会拒绝发送，不自动拆分成多次最终回复。
LINE 还需要公网 HTTPS webhook，由已有反向代理转发到 `127.0.0.1:8895/webhook`；
详细配置见 LINE 仓库。这个入口与给 Tunnel 使用的 MCP 端口分开。

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
PORT=8790
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
