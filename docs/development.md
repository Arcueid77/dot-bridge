# Development and verification / 开发与验证

## Responsibilities / 仓库分工

The distribution owns installation, selected-channel composition, lifecycle and service rendering. Providers own their platform protocols. Canonical transport, encrypted state, private files, media processing and registered-adapter routing live in `dot-bridge-core`.

总仓库维护安装、渠道组合与运行入口，独立渠道维护平台协议，共享实现仅在 core。单飞书部署选择 `lark`，所需固定组件包随总仓库安装。

## Version baseline / 版本基线

The 2026-11-05 functional baseline is distribution 0.8.2 with core 0.11.1. `components.lock.json` records source revisions, versions and artifact SHA-256 values. Private receipts record the actual running revision separately from later source-doc commits.

2026-11-05 功能基线为总包 0.8.2 / core 0.11.1。运行版本、源码、依赖包和现场验收分层记录。文档提交沿用已审核发行包，下一次发布再生成包含新文档的固定包。

Core 0.11.1 separates processing-feedback leases from final delivery. Reading/beginning work leaves an unqueued final reply at `none`; only a final write reports `processing`. Unknown native outcomes remain `uncertain`. The regression fails on old behavior and verifies one answer with the fix. Historical call details for the earlier unanswered message were unavailable.

0.11.1 修复处理提示与最终发送状态混用的问题。回归用例复现旧行为会跳过唯一回答，并验证修复后只发送一次；旧现场消息的完整调用明细未取得。

## Packaging / 固定包构建

1. Commit reviewed clean core source and build a versioned artifact.
2. Update every provider's artifact, `vendor/core-release.json` and lockfile to that same core version/SHA/hash.
3. Commit and validate providers, then regenerate the distribution:

```sh
npm run vendor -- --sources /absolute/path/to/sibling-source-checkouts
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm run check
npm test
```

4. Review/commit the composition and verify exact remote SHA and CI.

脚本仅打包干净、已提交的源码。先固定 core，再统一供应各渠道及路由器；私有状态留在仓库外。文档修改保持现有压缩包不变，通过下一次正常发布进入新版组件包。

## Checks / 检查范围

Use Node.js >=24.15 and <25. Windows ACL tests need installed Python selected by `DOT_BRIDGE_PYTHON`; legacy TLS tests also use OpenSSL. Core, eight providers and the distribution have Windows/Linux CI.

Tests use synthetic credentials/callbacks and provider-disabled readiness services. Installed multi-channel fixtures start all eight actual packaged readiness backends, checking catalogs, routing and attachment contracts. Core covers callbacks, encrypted queues, owner binding, context isolation, feedback, progressive/partial sends, expiry, restart and uncertain outcomes.

普通测试使用合成私有文件、注入网络和禁用平台的 readiness 入口。分别记录 OS、Node、通过、失败、跳过及未运行。文档检查验证本地链接、语言导航和 JSON 策略；文件清单变动还检查包内文档覆盖。

## Maintainer acceptance / 维护者验收记录

Dated record: 2026-11-05.

| Scope | Recorded result / 记录结果 |
| --- | --- |
| Source CI | Core + eight providers + distribution passed Windows/Linux workflows |
| VPS package | 36 Linux distribution tests passed; credentials, policies and original subscriptions retained |
| Lark | Owner status command, normal reply and three generated card chunks completed |
| Discord | Four progress frames, reaction/typing cleanup, context and post-restart replies completed once |
| Telegram | Three progress frames, bold/lists, native quote and post-restart reply completed once |
| QQ / Weixin | Existing gateway/subscription retained; current interaction acceptance awaits owner messages |
| DingTalk / WeCom / LINE | Source/CI available; account onboarding and real acceptance pending |
| New groups | Telegram/Discord rules tested synthetically; no new groups activated in that deployment |

The five-channel composition exposed 85 tools/five events; catalog size follows selected adapters. Hosted pause/reset/approval remain platform operations. Real media return and new-group behavior were not rerun in that browser acceptance.

现场记录保持脱敏，不放正文、身份、凭据或完整 callback。原 dot／平台负责真实续订；发送结果不明保持人工核对。私有迁移打包工具仍有历史双渠道范围，完整多渠道迁移另行验证。

## P1 interaction batch / P1 交互批次

The 0.9.0 distribution consumes core 0.12.0 and the exact component revisions in
`components.lock.json`. Independent providers retain platform protocol ownership.

- Native choices use verified prompt receipts and actor/chat/topic binding on
  Lark, Telegram and Discord. Durable selection precedes callback acknowledgement.
  Other channels use numbered text choices. Reminder controls bind an opaque ID
  and revision and remain owner-private.
- Generated-file uploads use encrypted bounded chunks, exact offsets, SHA-256
  verification and the existing final media queue. Actual generated-file handoff
  also requires programmatic file access and tool calls in the original dot.
- Long-answer delivery can select Markdown files or supported native chunks.
  Markdown splitting preserves fitting code/table sections and repeats long-table
  headers. Progressive replies coalesce small updates. Telegram albums persist
  before offset advancement and recover failed storage writes safely.
- Reminder controls add weekdays, bounded intervals, paused creation, pause,
  resume, pagination and twenty delivery attempts. The management view converts
  local IANA times and shares the loopback/origin/session gate.

Local Linux gates passed all ten `check` / `test` suites with 1,092 tests passed
and nine platform-specific skips. Windows suites passed with platform-specific
skips recorded in the per-repository logs. From the QQ working directory, the
canonical sibling-core transport suite passed 167 tests and the QQ tunnel suite
passed 61 on both platforms. The actual sibling integration cases ran.

An isolated Chromium run exercised create-paused, resume and history through the
management UI. Desktop/mobile screenshots were inspected, script exceptions were
zero and the 390-pixel layout had no document overflow. These checks use synthetic
records. Live card callbacks, native selections, generated-file transfer and
reminder controls still require the original dot and account-side acceptance.

## Review fixes 0.9.1 / 审查反馈修复

The 2026-11-11 composition pins QQ 0.9.1 and Lark 0.7.1; core remains 0.12.0.
QQ enforces the approved one-message experiment at tool and provider entrypoints,
including native streams, media, choices and proactive writes, while preserving
the router's catalog contract. Its Docker command now enters persistent-service
preflight. Lark reuses core private-file checks in every durable database mode,
including existing SQLite sidecars, without changing unsafe files on refusal.
The existing upload fix also passes 5 MiB file and image tests through a local TLS
proxy fixture with destination, redirect and revocation restrictions intact.

Local Node 24.22.2 results:

| Repository | Windows passed / skipped | Linux passed / skipped |
| --- | --- | --- |
| QQ | 271 / 0 | 263 / 8 |
| Lark | 287 / 20 | 304 / 3 |
| Distribution | 38 / 1 | 39 / 0 |

All three `check` commands passed on both systems. The two Linux ownership cases
requiring root passed separately, as did core's three private-file checks. The
remaining Linux skips are eight Windows-only QQ cases and one audio guard case
whose protected runtime is not installed in this local fixture. Windows skips
include Linux-only storage/audio cases and the systemd unit verifier. New
regressions reproduced three QQ and eight Lark failures on previous source;
the fixed cases passed. The installed distribution exercised all eight real
provider-disabled readiness backends. Packaging checks found the fixed artifacts
and no obsolete QQ/Lark artifacts or private files.

本批次已完成本地修复、固定包构建和 Windows／Linux 检查；尚未运行远程 CI、
完整 Docker 镜像构建或真实账号验收，也未部署到 VPS。这里的 Node 子进程测试
验证 Docker 默认命令会进入服务预检，缺配置时非零退出；它不代表整套容器环境已验收。
各仓库的开发说明保留详细边界，运行状态不从源码版本推断。

## Deployment / 部署维护

Stage an exact Git revision and dependency checks, settle work, back up databases consistently and switch selected adapters/router together. Keep MCP loopback and one official Tunnel target. Recovery preserves post-upgrade data, deduplication and delivery outcomes.

运行见[中文](operations.md)或 [English operations](operations.en.md)。小修复、文档和常规维护直接在 `main` 完成，不默认新建分支；较大且需要隔离的工作才使用 `dev/` 分支。源码、包检查、进程存活和真实消息验收分别记录。
