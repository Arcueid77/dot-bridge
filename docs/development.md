# Development and release composition

## QQ owner notifications in 0.7.0

This composition pins QQ 0.7.0 and one shared core 0.9.0 across every component.
QQ exposes owner-only proactive text and saved once/daily/weekly reminders,
disabled by default. It uses the original private database and storage key,
independently of inbound subscriptions. Explicit provider rejection persists as
`rejected` and pauses recurrence; unknown outcomes remain `uncertain` without
automatic retry. Current application eligibility and quota still need verification
because the official SDK and platform suspension notice give different guidance.

Source tests cover restart persistence, owner binding, duplicate intents,
permission/quota refusal, malformed ACKs, token-time revocation, and the expanded
catalog/list byte budgets. The actual QQ/Lark sibling catalog contains 32 tools.
The distribution tests the installed QQ adapter and outbox from its immutable
packages, including rejection projection. Local Windows validation passed QQ 264,
core 253 (5 Linux-only skips), Lark 274 (16 skips), the six other providers 172,
and distribution 33 (1 Linux-only skip). These are synthetic checks; production
configuration, account qualification and real QQ delivery were not exercised.

Standalone QQ/Lark CI also runs Linux and Windows. The hosted Windows bootstrap
temporarily makes its test process create files owned by the current user,
matching the final service-user model, and restores the prior token default
owner afterward. Production ownership/DACL checks are unchanged. These CI files
are excluded from component packages; advancing their source provenance keeps
the previously reviewed component archives byte-identical.

The distribution consumes independent component releases. It owns the CLI,
selected-channel composition, operator configuration, foreground lifecycle,
systemd rendering, and compatibility checks. Provider behavior remains in the IM
repositories; transport and security primitives remain in core.

## Management and media composition in 0.4.0

The loopback-only management entry serves the operator interface and fixed,
redacted APIs. It does not receive credentials, create host subscriptions, run
pairing, start consumers, or execute code from a selected release. Configuration
writes change only channel selection, require a matching revision and explicit
confirmation, and retain a private backup. Upgrade checks verify installed local
artifacts and produce an administrator runbook; they do not claim cutover.

Connection diagnosis distinguishes loaded callback settings from merely edited
files, preserves the different setting names used by established and new
providers, and never treats an intentional wait for subscription as a gateway
failure. Complete outbound counts include retained stream and feedback work;
an already displayed, idle feedback card is not outstanding work.

The canonical MCP media budget is 5 MiB. Tests serialize the official Tunnel
wire envelopes, including Go JSON escaping and duplicate rich-result metadata,
against its default 10 MiB limit. A conservative additional Base64 wrapper is
also checked. Previously queued oversized media remain intact rather than being
sent, dropped, or changed to an unknown-outcome state during inspection.

New providers preserve a single durable final reply. Long text becomes a file
where necessary; LINE keeps its existing single-call text chunks. Weixin adds
validated native SILK voice replies. LINE media uses a separately approved,
short-lived HTTPS publisher with an independent signing key, bounded memory,
and explicit opt-in. Reverse-proxy examples disable body/response disk buffering
and URI-bearing logs. Neither temporary URL expiry nor buffer clearing is a
claim of physical erasure. This release does not add text-to-speech synthesis.

Windows browser automation was stopped because its current browser URL could
not be identified confidently. HTTP/API tests do not replace visual acceptance.
Unused tracked older core archives remain present; dependency locks and the npm
override select exactly one reviewed core at runtime.

## Component interface

Each IM package exposes `adapter`, `config`, `runtime/live`,
`runtime/readiness`, and `package.json`. The distribution statically registers
installed adapters; neither remote input nor environment values select module
paths or executable programs. `components.lock.json` records canonical source
repositories, revisions and artifact digests.

The private registry packages are not yet published. Reviewed tarballs are
included in `vendor/`. The npm override pins one shared core release across all
components. A clean checkout requires only this repository and `npm ci`.

## Rebuild artifacts

Use Node >=24.15 and <25. Commit component changes first; the packer refuses dirty
source checkouts. It archives the committed tree into a temporary directory,
packs with lifecycle scripts disabled, checks the channel core references, and
updates the component manifest. Source checkout line endings cannot affect the
release archive.

```bash
npm run vendor -- --sources ..
npm install --omit=dev --ignore-scripts --no-audit --no-fund
npm run check
npm test
```

All referenced source commits must be reachable in their canonical public
repositories before pushing a public distribution release. Publish dependency
branches as appropriate; do not silently merge unrelated main branches.

## Checks

`check` validates syntax, artifact SHA-256, npm SHA-512 integrity, installed
versions and consistent core provenance. Tests exercise the actual packaged
Lark/QQ readiness services and aggregate without sibling source paths, plus
single-channel omission, explicit live gates, independent credentials, hostile
dotenv controls, occupied ports, child failure cleanup and systemd rendering.

Synthetic readiness uses temporary private files and disabled provider
transports. It creates no real IM consumer, Tunnel client or dot subscription.
Linux additionally runs `systemd-analyze verify` when available. Real pairing,
provider delivery and production cutover are separate operator activities.

## Runtime boundaries

- The manifest controls enabled channels. Disabled channels have no credential
  reads or child processes, although their reviewed code can be installed.
- Router environment accepts only the aggregate's settings; upstream ports and
  service-key references are derived from selected backend environments.
- Environment files use core's private-file checks. Loader injection variables,
  duplicate fields and inherited provider credentials are rejected or omitted.
- `run` starts supervised children, probes authenticated loopback catalogs and
  drains in reverse order on Ctrl+C, startup failure or child failure. The stdin
  control pipe is enabled only for this explicit foreground supervisor.
- systemd launches the same package entrypoints directly and uses ordinary
  signals. It does not enable the finite-launcher stdin supervision switch.
- The official Tunnel remains independently configured; the distribution never
  fabricates an owner identity, callback URL or runtime credential.

The six new providers use core 0.7.x encrypted channel runtime. Platform protocol fixtures live in each independent repository. `multi-channel.test.js` starts all eight actual packaged readiness backends and checks their authenticated catalogs without sibling source checkouts. It also requires the source-attachment reply contract in every installed live adapter. `channel-runtime.test.js` in core exercises signed callback challenge, owner binding, encrypted state, uncertain sends, restart persistence, subscriptions and the actual router. Media regression includes authorization revocation during upload/read, retained encrypted capacity, bounded UTF-8 rich results and no replay after uncertain sends. Pairing uses expiring nonce fixtures and real private-file permission tests. Optional SILK runs in bounded workers using codec dependencies pinned by the individual providers.

Source attachment replies use the existing encrypted media outbox format. The generic runtime hashes the normalized reference request before reading bytes, so an identical retry returns persisted state without another download. QQ retains its source-reference digest inside the encrypted media plan when upload bytes are replaced by the durable file receipt. No SQLite schema change is needed. Provider format limits and authorization gates still run before queue/upload/final send. Passive file excerpts share a bounded UTF-8/UTF-16 decoder; no new document subprocess or external service is installed.

Platform priorities are documented in `im-roadmap.md`. cc-connect is a research
reference for platform transports; its model/agent runtime and platform code are
not vendored by this repository.

## 0.8.0 owner-message package

Weixin now implements the shared owner-only proactive text and durable reminder
contract without reading or reusing an inbound context token. Explicit platform
refusals remain rejected; missing acknowledgements and transport failures remain
uncertain. Actual account acceptance and visible receipt need live verification.

All eight component packages pin the same reviewed core 0.10.0 artifact. The
distribution retains the nine current component archives; historical releases
remain reproducible from their exact Git revisions. Runtime data and rollback
state stay outside these source artifacts.


## 0.8.2：最终回复状态兼容修复

core 0.11.1 将最终发送状态与处理提示租约分开。读取消息或开始处理后，尚未排队的最终回复仍返回 `none`；真正进入最终发件写入才返回 `processing`，原生写入结果不明仍保留 `uncertain`。新增合成回归复现旧行为阻止唯一回复的问题，并验证修复后只发送一次。历史调用明细未取得，旧消息未回复的确切原因仍待核对。

Core 0.11.1 separates final delivery from the processing-feedback lease. An unqueued final reply remains `none` while typing/processing feedback is active; an actual final outbox write reports `processing`, and an ambiguous native write remains `uncertain`. The regression reproduces suppression of the only final answer and verifies one send after the fix. Historical execution details were unavailable; the exact stop reason of the old message remains unverified.
