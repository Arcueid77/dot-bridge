# 还能接入哪些聊天应用

当前发行版可用的是 **飞书 / Lark、QQ 官方机器人**。下面是其他渠道的接入候选，尚未实现，不会出现在启动列表中。

本次参考 [cc-connect 的平台实现](https://github.com/chenhg5/cc-connect/tree/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/platform)，核对日期为 2026-10-19。cc-connect 连接的是本地编程 Agent；这里借鉴其 IM 侧接法，dot 侧继续使用现有官方 Tunnel 和事件订阅。

## 本轮接入顺序

按当前需求，依次推进钉钉、企业微信、微信 iLink、Discord、Telegram 和 LINE。每个渠道使用独立仓库，随实现一起创建；完成后再加入总发行版。

| 渠道 | 计划仓库 | cc-connect 采用的接法 | 接入时需要处理 |
| --- | --- | --- | --- |
| [钉钉](https://github.com/chenhg5/cc-connect/blob/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/docs/dingtalk.md) | `dot-dingtalk-bridge` | Stream / WebSocket | 企业应用权限、消息类型转换和回复凭据的有效期；部署方式与现有飞书长连接接近 |
| [企业微信](https://github.com/chenhg5/cc-connect/blob/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/docs/wecom.md) | `dot-wecom-bridge` | 智能机器人 WebSocket；也有应用回调方案 | 优先采用长连接，需要账号具备创建对应智能机器人的资格；普通群机器人 webhook 不具备完整的双向收发能力 |
| [微信 iLink](https://github.com/chenhg5/cc-connect/blob/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/docs/weixin.md) | `dot-weixin-bridge` | iLink 长轮询、扫码绑定 | 扫码授权、登录失效、消息游标、媒体及 `context_token`；可用的私聊和群聊能力取决于实际账号与接口 |
| [Discord](https://github.com/chenhg5/cc-connect/blob/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/docs/discord.md) | `dot-discord-bridge` | Gateway WebSocket | Bot、频道和成员授权、所需 intents；私聊、群频道和线程分别绑定 |
| [Telegram](https://github.com/chenhg5/cc-connect/blob/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/docs/telegram.md) | `dot-telegram-bridge` | Bot API 长轮询 | Bot token、本人白名单、消息游标持久化和附件下载；无需公网入站端口 |
| [LINE](https://github.com/chenhg5/cc-connect/tree/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/platform/line) | `dot-line-bridge` | Messaging API webhook | HTTPS 入站地址、签名校验及回复 token 时效；部署时需要额外配置接收回调的入口 |

Slack 不在本轮接入范围内，优先使用 dot 已有的官方支持。

## 暂不安排

| 候选 IM | 接法 | 主要前置条件 |
| --- | --- | --- |
| [Matrix](https://github.com/chenhg5/cc-connect/blob/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/docs/matrix.md) | `/sync` 长轮询 | homeserver、专用设备与访问令牌；加密房间需要额外处理 E2EE 设备和密钥状态 |
| [Google Chat](https://github.com/chenhg5/cc-connect/blob/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/docs/googlechat.md) | Chat App + Cloud Pub/Sub pull | Google Cloud 项目、服务账号及 IAM；部署与账号管理比普通 bot 更复杂 |

源码里还出现微博、WPS 协作 / AgentSpace、Webex、MAX、元宝、推推等目录。它们可以作为后续调查入口，不能仅凭目录存在就承诺本项目支持，也需要分别确认官方开放资格和实际使用需求。`cloud-web` 属于 Web 交互入口，不作为新增 IM 计数。

## 新渠道如何进入总发行版

现有 `dot-lark-bridge`、`dot-qq-bridge` 和 `dot-bridge-core` 保持独立。各渠道仓库负责平台接入，`dot-bridge-core` 提供共享能力，`dot-bridge` 总仓库负责统一安装、配置和运行管理。用户可以只启用自己需要的渠道。

1. 新建独立 `dot-<渠道>-bridge` 仓库，完成平台绑定、收发、附件及平台限制处理。
2. 公共能力复用 `dot-bridge-core`；提供统一的组件导出和渠道能力说明。
3. 在总仓库登记固定版本，补齐配置入口、运行管理和组合测试。
4. 使用真实账号确认原 dot 收到消息、原会话只回复一次，以及重启恢复。
5. 完成后才加入 `channels` 命令与可启动配置。

平台 token 和 dot 的 Tunnel runtime key 是两种不同凭据。新增渠道不意味着改用模型 API，也不意味着更换原 dot。QQ 个人号 OneBot/NapCat 与已有的 QQ 官方机器人也是两种接入方式，应分开评估。
