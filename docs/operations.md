# 安装、迁移与常驻运行

## 首次接入

准备 Node.js 24（至少 24.15），然后按根目录 README 安装总仓库。

各渠道的配对流程继续使用自己的官方应用与组件引导：

- [飞书配置与配对](https://github.com/Arcueid77/dot-lark-bridge/blob/686347bb83263edb9e1149c7fe1a4b323f2d5e4f/docs/configuration.md)
- [QQ 配置与绑定](https://github.com/Arcueid77/dot-qq-bridge/blob/b6c24d2021a4dcf6eec1e154b61ce61252fef2cf/docs/configuration.md)

总入口读取已有配置，不代替平台授权，也不创建新的 dot。示例文件在 [examples](../examples)：它们只包含路径与占位符，需要换成自己的已核验配置。

聚合入口和每个启用渠道各用一份独立 service key；数据库存储密钥与平台凭据也保持独立。私有文件放在最终运行用户拥有的目录中：Linux 目录 0700、文件 0600；Windows 使用私有 ACL。不要把凭据放进项目目录或提交到 Git。

清单可以放在项目外，例如 `/var/lib/dot-bridge/bridge.json`。`init` 只创建清单文件，目标存在时会拒绝覆盖。`channels` 中只保留需要运行的渠道；聚合器会据此生成上游端口和密钥文件引用，无需在两处重复维护启用列表。

正式运行的数据目录约定：

```text
/var/lib/dot-bridge/
  bridge.json
  private/            环境文件、配对文件、密钥
  lark/               飞书数据库及其 WAL/SHM
  qq/                 QQ 数据库及其 WAL/SHM
  locks/              模式锁及共享语音锁
```

可以通过 `dataDirectory` 改变根目录。每个渠道的 `DATABASE_PATH` 必须位于自己的子目录，`BRIDGE_LOCK_DIRECTORY` 指向根目录下的 `locks`。

## Windows 私有文件检查

已有 Python 3 时，在运行检查或前台启动的 PowerShell 中选择它：

```powershell
$env:DOT_BRIDGE_PYTHON = (Get-Command python.exe).Source
& $env:DOT_BRIDGE_PYTHON --version
```

确认显示真实的 Python 3 版本；Microsoft Store 的安装占位程序不能代替解释器。也可以直接填写已有 `python.exe` 的绝对路径。子进程会沿用这个明确选择，私有文件 ACL 检查仍然生效。

## 官方 Tunnel 与原 dot

沿用[官方 Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)提供的客户端和当前版本支持的配置方式。只运行一个对应的 Tunnel 客户端实例，将 MCP HTTP target 指向聚合入口，例如 `http://127.0.0.1:8789/mcp`。

入口的 `X-Dot-Bridge-Service-Key` 使用聚合 key 的文件引用。实际客户端参数和 `file:` 语法以已安装版本及官方说明为准。Tunnel runtime key、私有 profile 和订阅 callback 都不由总入口生成。

在原 dot 中刷新现有插件目录，再由原 dot 建立或续订对应渠道的真实事件订阅。callback 必须来自这个订阅流程。进程在线和本地目录可访问不代表 IM 已经接通；最后从本人私聊发消息，确认原 dot 在原会话回复。

事件订阅有有效期，由原 dot／平台按照 `refreshBefore` 续订。升级、重启服务会保留数据库里的订阅状态，但不会替原 dot 延长订阅。

## 从现有桥迁移

1. 保留原配置、配对文件、storage key、数据库和有效订阅。
2. 用总仓库创建一个指向原环境文件的清单，以原运行用户执行 `doctor`。
3. 确认没有未完成的回复任务，优雅停止原来的对应消费者。跨主机迁移需要单独确认旧主机已经停止。
4. 若必须移动数据库，使用 SQLite 一致性备份或停机后的完整备份，保留原 storage key。
5. 用总入口启动同一份状态，观察原消息没有重复发送，再发送新消息确认收发。

总仓库读取数据库的方式由各组件决定，不会导入旧目录的临时文件，也不会重建身份或去重状态。端口已占用时，前台启动会拒绝继续。

## Linux 常驻运行

推荐把总仓库安装在运行用户可读、普通运行用户不可修改的位置，例如 `/opt/dot-bridge/distribution`。准备专用非 root 用户、对应的数据目录、私有文件和清单，并确保运行用户能读取清单。

先以该用户运行 `doctor`，然后由管理员在**最终 Linux 主机**生成服务文件：

```bash
node bin/dotbridge.js service render --config /var/lib/dot-bridge/bridge.json --output ./systemd-output
```

生成目录必须是新目录。文件使用绝对路径、专用运行用户、失败重启和 180 秒优雅停止。各 IM 只获得自己的数据目录及共享锁目录的写权限；聚合器无状态目录写权限。普通 systemd 服务使用信号停止。

管理员检查生成的单元和目标路径后安装。**已有同名服务时先备份并安排切换，不直接覆盖正在使用的定义。** 新安装示例：

```bash
sudo install -m 0644 systemd-output/*.service systemd-output/*.target /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dot-bridge.target
sudo node bin/dotbridge.js service start --config /var/lib/dot-bridge/bridge.json --confirm-live
```

这里管理选中的 IM 组件和聚合路由。官方 Tunnel 客户端仍使用它已有的服务。如果希望启动目标时同时拉起一个已配置好的 Tunnel 服务，可在清单的 `systemd` 中设置 `tunnelUnit`（例如 `dot-bridge-tunnel.service`）；该服务自身的停止关系继续由它的单元定义决定。

如果希望并存另一套完全独立的配置，可以修改 `systemd.prefix`，同时分开端口、状态、凭据和绑定；不要把同一个平台应用的消费者同时开两份。

## 查看状态与日志

```bash
node bin/dotbridge.js status --config /var/lib/dot-bridge/bridge.json
node bin/dotbridge.js service status --config /var/lib/dot-bridge/bridge.json
journalctl -u dot-bridge-lark.service -u dot-bridge-qq.service -u dot-bridge-router.service
```

前台总入口输出组件启停和认证目录状态，不转发第三方 SDK 的原始诊断文字。systemd 日志使用各组件已有的日志行为。新生成的单元使用主机默认 journald 保留策略；如需限定天数和容量，由管理员为服务配置独立 namespace 和保留策略。它不会继承某台旧服务器的日志设置。

媒体、群聊和语音能力分别受平台接口、渠道配置与 dot 能力限制。QQ 的官方机器人与个人号 OneBot/NapCat 属于不同接法；本发行版提供的是前者。

## 更新与回滚

整套版本由总仓库固定。更新前先停止服务、保存当前代码版本和 `node_modules`，按需要做一致性数据库备份，再切换到已核验的总仓库版本并运行：

```bash
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
node bin/dotbridge.js doctor --config /var/lib/dot-bridge/bridge.json
sudo node bin/dotbridge.js service start --config /var/lib/dot-bridge/bridge.json --confirm-live
```

凭据和数据继续放在仓库外。回滚代码时使用上一套代码与依赖，并先检查数据结构兼容性；不要用旧数据库覆盖升级后新收到的消息。已发送及 `uncertain` 的任务保持原状态，不自动重发。更换安装路径后需要重新生成并核对 systemd 中的绝对路径。
