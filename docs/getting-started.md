# 从零把聊天软件接入 DotBridge

[English](getting-started.en.md) · [返回首页](../README.md)

下面以 Linux VPS 和 Telegram 本人私聊为例，完成后可以从 Telegram 向原来的 dot 发消息并收到回复。其他渠道共用后半段的 Tunnel 和订阅流程，平台准备方法见文末。

整个过程需要你操作平台账号、保存私有文件，并在 ChatGPT 中连接插件。示例约定代码放在 `/opt/dot-bridge/app`，数据放在 `/var/lib/dot-bridge`，服务用户为 `dot-bridge`。已有运行实例请先按[迁移说明](operations.md)安排切换，继续使用原绑定、存储密钥和数据库。

## 1 先确认 OpenAI 账号权限

在准备机器人前，先打开 [OpenAI 官方 Tunnel 指南](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)，确认自己能管理所需 Tunnel，并能在目标 ChatGPT 工作区添加自定义 MCP 插件。

- 创建或修改 Tunnel 的操作者需要组织级 `Tunnels Read + Manage`。
- 运行客户端和选择 Tunnel 需要 `Tunnels Read + Use`。
- Tunnel 应关联使用这个 dot 的 ChatGPT 工作区。

这些权限由对应组织或工作区的管理员授予。个人账号按官方指南选择属于自己的 Platform 组织。

本人私用的接入，应将 Tunnel 使用权限限定给自己的接入主体，插件也保持个人私用。

准备完成后，消息按下面的路径流转。

```mermaid
flowchart LR
    U[本人 Telegram 私聊] --> B[Telegram 桥]
    B -->|订阅通知 HTTPS| D[原来的 dot]
    D -->|调用工具| T[官方 Secure MCP Tunnel]
    T --> C[运行主机上的官方客户端]
    C --> R[本机 MCP 聚合路由]
    R --> B
    B -->|回复原私聊| U
```

官方客户端主动建立出站 HTTPS 连接。新消息通过原 dot 的事件订阅通知它，读取消息和回复则通过 Tunnel 调用桥的工具。

## 2 安装总仓库和准备目录

运行主机需要 Node.js `>=24.15` 且 `<25`、OpenSSL，以及访问 Telegram 和 OpenAI 的出站网络。网络有强制代理时，按该环境要求配置出站访问并保留 TLS 校验。

将所选版本的源码或发行包放到 `/opt/dot-bridge/app`。目录中应包含 `package.json`、`package-lock.json` 和 `vendor/`。在该目录安装依赖。

```bash
cd /opt/dot-bridge/app
node --version
umask 022
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
```

总包已包含 core 与各渠道的固定组件包。管理员在新主机创建服务用户和私有目录。

```bash
id dot-bridge >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/dot-bridge --shell /usr/sbin/nologin dot-bridge
install -d -m 0700 -o dot-bridge -g dot-bridge \
  /var/lib/dot-bridge \
  /var/lib/dot-bridge/private \
  /var/lib/dot-bridge/private/keys \
  /var/lib/dot-bridge/private/tunnel \
  /var/lib/dot-bridge/telegram \
  /var/lib/dot-bridge/locks
```

下面的 `runuser` 命令在管理员终端中执行，实际程序使用 `dot-bridge` 身份。Node 应安装在该用户可访问的系统路径中。代码及已安装依赖由管理员维护为运行用户只读。

Windows 可按[Windows 私有文件说明](operations.md#windows-私有文件检查)准备已有 Python 与私有 ACL，再使用自己的绝对路径运行后续配对和 CLI 命令。常驻服务部分采用 Linux systemd。

## 3 创建 Telegram Bot 并绑定本人

在 Telegram 官方 [BotFather](https://t.me/BotFather) 中创建一个专用 Bot，保存它的用户名。用受信任的编辑器，把 Token 写到运行主机上的新纯文本文件 `/var/lib/dot-bridge/private/telegram.bot-token`，文件中只放 Token。Token 保留在私有文件中。

管理员核对文件属主和权限。

```bash
chown dot-bridge:dot-bridge /var/lib/dot-bridge/private/telegram.bot-token
chmod 0600 /var/lib/dot-bridge/private/telegram.bot-token
```

确认这个 Bot 的旧收发程序已停止后，从总仓库目录运行配对命令。

```bash
runuser -u dot-bridge -- node node_modules/dot-telegram-bridge/scripts/pair-owner.js \
  --token-file /var/lib/dot-bridge/private/telegram.bot-token \
  --credentials-file /var/lib/dot-bridge/private/telegram.credentials.json \
  --confirm-stopped --confirm-private-storage
```

终端会显示一条 `/start db_…` 命令。两分钟内，从你本人的 Telegram 账号，把整条命令发给刚创建的 Bot。看到凭据保存成功后，再进入下一步。程序会保存本人和私聊的绑定。

遇到已有 webhook、其他消费者或积压更新的提示时，先处理对应迁移问题。配对的完整说明见 [Telegram 本人配对](https://github.com/Arcueid77/dot-telegram-bridge/blob/main/docs/setup.md)。

## 4 准备桥的密钥和环境文件

这套接入会用到几种不同的凭据。

| 文件或凭据 | 用途 |
| --- | --- |
| Bot Token 和配对文件 | 连接 Telegram，限定本人私聊 |
| 每渠道 service key | 聚合路由访问对应渠道 |
| 聚合器 service key | 官方 Tunnel 客户端访问聚合路由 |
| 每渠道 storage key | 加密该渠道的本地数据，更新时继续保留 |
| OpenAI Tunnel runtime key | 官方客户端连接 OpenAI Tunnel 控制面 |

为本次新安装生成 Telegram service key、storage key 和聚合器 service key。命令将它们直接保存到私有文件中，目标已存在时会停止。

```bash
runuser -u dot-bridge -- node --input-type=module <<'JS'
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';

const keys = [
  ['telegram-service-key', 'base64url'],
  ['telegram-storage-key', 'base64'],
  ['aggregate-service-key', 'base64url']
];
for (const [name, encoding] of keys) {
  writeFileSync('/var/lib/dot-bridge/private/keys/' + name,
    randomBytes(32).toString(encoding), {mode: 0o600, flag: 'wx'});
}
JS
```

创建 `/var/lib/dot-bridge/private/telegram.env`，填写这些路径。

```dotenv
AUTH_MODE=tunnel-service
BRIDGE_MODE=tunnel
TUNNEL_SERVICE_OPERATION=live
TUNNEL_SERVICE_OWNER_ID=tunnel-owner:dot-bridge
HOST=127.0.0.1
PORT=8794
TUNNEL_SERVICE_KEY_FILE=/var/lib/dot-bridge/private/keys/telegram-service-key
TELEGRAM_CREDENTIALS_FILE=/var/lib/dot-bridge/private/telegram.credentials.json
STORAGE_KEY_FILE=/var/lib/dot-bridge/private/keys/telegram-storage-key
DATABASE_PATH=/var/lib/dot-bridge/telegram/bridge.sqlite
BRIDGE_LOCK_DIRECTORY=/var/lib/dot-bridge/locks
CALLBACK_TRANSPORT_MODE=standard
CALLBACK_HOSTS=
```

创建 `/var/lib/dot-bridge/private/router.env`。

```dotenv
AUTH_MODE=tunnel-service
BRIDGE_MODE=tunnel
TUNNEL_SERVICE_OPERATION=live
TUNNEL_SERVICE_OWNER_ID=tunnel-owner:dot-bridge
HOST=127.0.0.1
PORT=8789
TUNNEL_SERVICE_KEY_FILE=/var/lib/dot-bridge/private/keys/aggregate-service-key
```

管理员设置这两个文件的权限。

```bash
chown dot-bridge:dot-bridge /var/lib/dot-bridge/private/telegram.env /var/lib/dot-bridge/private/router.env
chmod 0600 /var/lib/dot-bridge/private/telegram.env /var/lib/dot-bridge/private/router.env
```

上游列表由总入口按清单生成。示例端口需要在本机空闲；改端口时，同时更新后面的 Tunnel 地址。`CALLBACK_HOSTS` 先留空，等第 7 步拿到原 dot 真实订阅使用的域名后再填写。

创建清单，并检查配置。

```bash
runuser -u dot-bridge -- node bin/dotbridge.js init \
  --config /var/lib/dot-bridge/bridge.json --mode live --channels telegram \
  --env-dir /var/lib/dot-bridge/private --data-dir /var/lib/dot-bridge
runuser -u dot-bridge -- node bin/dotbridge.js doctor --config /var/lib/dot-bridge/bridge.json
```

在终端 A 前台启动桥，保持这个终端运行。

```bash
runuser -u dot-bridge -- node bin/dotbridge.js run \
  --config /var/lib/dot-bridge/bridge.json --confirm-live
```

这时界面可能显示“待 dot 订阅”。继续连接 Tunnel 和消息订阅即可。

## 5 配置并运行官方 Tunnel 客户端

按照 [OpenAI 官方指南](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)创建或复用自己的 Tunnel，关联目标工作区，并准备最小权限的 runtime key。将 key 保存到 `/var/lib/dot-bridge/private/tunnel/runtime-api-key`，属主为 `dot-bridge`，权限为 `0600`。

从 [官方客户端下载页](https://github.com/openai/tunnel-client/releases/latest)选择运行主机对应的系统与架构，将二进制安装到 `/opt/dot-bridge/bin/tunnel-client`，赋予 `0755` 权限。先查看客户端自己的说明。

```bash
/opt/dot-bridge/bin/tunnel-client help quickstart
```

在 `/var/lib/dot-bridge/private/tunnel/profile.yaml` 保存下面的配置，把 Tunnel ID 占位值换成自己平台里的标识。该文件也使用 `dot-bridge` 属主和 `0600` 权限。

```yaml
config_version: 1
control_plane:
  base_url: https://api.openai.com
  tunnel_id: REPLACE_WITH_YOUR_TUNNEL_ID
  api_key: file:/var/lib/dot-bridge/private/tunnel/runtime-api-key
  poll_channels: [main]
mcp:
  server_urls:
    - channel: main
      url: http://127.0.0.1:8789/mcp
  extra_headers:
    X-Dot-Bridge-Service-Key: file:/var/lib/dot-bridge/private/keys/aggregate-service-key
log:
  level: info
  format: json
health:
  listen_addr: 127.0.0.1:0
admin_ui:
  open_browser: false
```

这个 profile 的 `main` 指向聚合路由，鉴权 Header 引用聚合器的 service key 文件。平台机器人 Token 保存在各渠道自己的私有文件中。

同一 Tunnel 的 `main` 通道由一个客户端实例承接。复用已有接入时，先核对当前 profile 和运行进程，再安排切换。

在终端 B 检查配置，然后保持客户端运行。终端 A 的桥也继续运行。

```bash
runuser -u dot-bridge -- /opt/dot-bridge/bin/tunnel-client doctor \
  --config /var/lib/dot-bridge/private/tunnel/profile.yaml --explain
runuser -u dot-bridge -- /opt/dot-bridge/bin/tunnel-client run \
  --config /var/lib/dot-bridge/private/tunnel/profile.yaml
```

客户端需要持续运行，dot 才能通过它调用本机的桥。MCP 端口保持监听 `127.0.0.1`。

## 6 在原 dot 中连接插件

在使用原 dot 的同一 ChatGPT 工作区打开 Plugins，点击加号，选择 Add custom MCP server。Connection 选择 Tunnel，再选择刚才的 Tunnel ID。具体界面见 [官方连接说明](https://developers.openai.com/api/docs/guides/custom-mcp-server)。

本例使用桥的 service-key 鉴权，Header 由运行端的 Tunnel profile 注入，插件按无 OAuth 的方式连接。阅读权限提示并确认连接的是自己部署的桥后，创建个人插件。

连接后，确认工具目录中出现 `check_telegram_readiness`、`get_telegram_message` 和 `reply_to_telegram`。原 dot 后续使用这个插件处理消息。

## 7 让原 dot 建立消息订阅

在原 dot 中发送下面的要求。已有任务时由它复用和核对原任务。

> 请使用现有 DotBridge Tunnel 插件，检查 Telegram 的消息事件任务。已有则复用，确认尚无才创建一次 telegram.message.created 订阅，限定 conversation=owner。收到消息后用 get_telegram_message 读取，用 reply_to_telegram 回复原私聊，每条只回复一次。使用你真实生成的 callback。若需要允许回调域名，只报告精确 hostname，等待我配置后再尝试。保留实际错误码和脱敏原因。

原 dot 如果要求批准回调域名，核对这次请求的精确域名后，在 `telegram.env` 中填写 `CALLBACK_HOSTS`。保存后核对文件仍为 `dot-bridge` 所有、`0600`，并保留标准 HTTPS 与 TLS 校验。在终端 A 优雅停止桥，再用相同命令启动以加载配置，最后请原 dot 完成这一次订阅。

订阅保存并启用后，从你本人的 Telegram 私聊发送一句容易识别的新文字。收到原 dot 在原私聊的回复后，再发送另一句不同的文字。后续可按需要尝试图片、语音和文件。

订阅有有效期，由原 dot／平台按返回的期限续订。运行主机继续保持在线。

## 8 改为 Linux 常驻运行

两条私聊都能正常回答后，在终端 A、B 分别优雅停止本次前台桥和客户端。用当前代码目录生成桥的 systemd 文件。

```bash
runuser -u dot-bridge -- node bin/dotbridge.js service render \
  --config /var/lib/dot-bridge/bridge.json \
  --output /var/lib/dot-bridge/systemd-plan
```

管理员先核对 `/etc/systemd/system/` 中相关服务名。新安装使用生成的 `dot-bridge-telegram.service`、`dot-bridge-router.service` 和 `dot-bridge.target`。源文件的 Node 与程序路径应指向本次安装的绝对路径。同名服务已存在时，先按[迁移说明](operations.md)核对生效配置。

在确认目标为本次新安装后，把核对过的单元安装到 systemd 目录。

```bash
install -m 0644 /var/lib/dot-bridge/systemd-plan/dot-bridge-telegram.service /etc/systemd/system/dot-bridge-telegram.service
install -m 0644 /var/lib/dot-bridge/systemd-plan/dot-bridge-router.service /etc/systemd/system/dot-bridge-router.service
install -m 0644 /var/lib/dot-bridge/systemd-plan/dot-bridge.target /etc/systemd/system/dot-bridge.target
```

官方客户端另设 `/etc/systemd/system/dot-bridge-tunnel.service`，使用同一私有 profile。

```ini
[Unit]
Description=DotBridge official Secure MCP Tunnel
Wants=network-online.target dot-bridge-router.service
After=network-online.target dot-bridge-router.service

[Service]
Type=simple
User=dot-bridge
Group=dot-bridge
ExecStart=/opt/dot-bridge/bin/tunnel-client run --config /var/lib/dot-bridge/private/tunnel/profile.yaml
Restart=on-failure
RestartSec=5s
TimeoutStopSec=45s
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/dot-bridge
LimitCORE=0

[Install]
WantedBy=multi-user.target
```

管理员安装核对过的单元后，加载配置并启用服务。

```bash
systemctl daemon-reload
systemctl enable --now dot-bridge.target
systemctl enable --now dot-bridge-tunnel.service
```

此后服务由 VPS 的 systemd 管理。部署电脑断开 SSH 后，可再发一条本人私聊确认回复。

## 用管理页查看进度

在运行主机启动本机管理界面。

```bash
runuser -u dot-bridge -- node bin/dotbridge.js ui \
  --config /var/lib/dot-bridge/bridge.json --port 5399
```

在部署电脑建立 SSH 转发，再打开 `http://127.0.0.1:5399`。

```bash
ssh -N -L 5399:127.0.0.1:5399 YOUR_SERVER
```

两端使用相同端口。页面可查看绑定、网关、订阅到期时间，以及当前卡在哪一步。更多操作见[管理界面](management.md)。

## 其他 IM 要准备什么

替换第 3 步的平台准备和配对，后续使用自己的渠道标识与文件路径。环境字段按对应渠道的模板准备，飞书、QQ 分别使用各自的原生配置模板。

| 渠道 | 平台侧准备与本人绑定 | 说明 |
| --- | --- | --- |
| 飞书 | 企业自建应用、机器人、可用范围，完成本人私聊配对 | [飞书部署](https://github.com/Arcueid77/dot-lark-bridge/blob/main/docs/deployment.md) |
| QQ | 官方机器人应用，通过对应引导扫码绑定本人 | [QQ 部署](https://github.com/Arcueid77/dot-qq-bridge/blob/main/docs/deployment.md) |
| 钉钉 | 企业内部机器人、Stream 模式、Client ID 和 Secret，私聊临时口令配对 | [钉钉配置](https://github.com/Arcueid77/dot-dingtalk-bridge/blob/main/docs/configuration.md) |
| 企业微信 | 智能机器人 API 长连接、Bot ID 和 Secret，私聊临时口令配对 | [企业微信配置](https://github.com/Arcueid77/dot-wecom-bridge/blob/main/docs/configuration.md) |
| 微信 iLink | 在运行主机启动登录流程，由本人扫码生成绑定 | [微信登录](https://github.com/Arcueid77/dot-weixin-bridge/blob/main/docs/setup.md) |
| Discord | 自己的 Bot Token、本人 User ID、一对一 DM Channel ID | [Discord 配置](https://github.com/Arcueid77/dot-discord-bridge) |
| LINE | 官方账号 Messaging API、Channel Secret 和 Token、本人绑定，公网 HTTPS webhook | [LINE 配置](https://github.com/Arcueid77/dot-line-bridge/blob/main/docs/setup.md) |

为新增渠道分别准备 service key、storage key、凭据和数据目录，并在清单中加入该渠道。其消息事件为 `<渠道>.message.created`。组合配置见[多渠道说明](new-channels.md)。

配套渠道文档也随组件安装在 `node_modules/<包名>/docs` 中，可按安装版本查阅。

## 卡住时先看这里

| 现象 | 下一步 |
| --- | --- |
| ChatGPT 中找不到 Tunnel | 核对目标工作区关联及组织级 Read／Use 权限 |
| 可以看到工具，私聊没有回复 | 查看原 dot 的消息订阅是否保存、启用、仍在有效期内 |
| 返回 callback_policy_required | 使用这一次真实订阅的 hostname 配置 CALLBACK_HOSTS，再完成订阅 |
| 启动提示私有路径不安全 | 核对实际运行用户、0700／0600 权限及文件链接情况 |
| Telegram 报冲突或已有 webhook | 协调旧实例、webhook 和待处理更新的迁移 |
| 更新后想回到旧版 | 保留当前数据与存储密钥，按[回滚说明](operations.md#降级新版提醒与选项)处理兼容性 |
