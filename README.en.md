# DotBridge

Connect your chat apps to your existing ChatGPT dot. Send a message from your familiar chat app and let the same dot handle it and reply.

This repository is the unified installation and operations entry point. Select Lark, QQ, DingTalk, WeCom, Weixin iLink, Discord, Telegram or LINE as needed. Each channel remains maintained in its own repository.

[简体中文](README.md) · [Getting started](docs/getting-started.en.md) · [Operations](docs/operations.en.md) · [Roadmap to 1.0](docs/im-roadmap.en.md)


Received attachments can be reused by their source-message index, without copying Base64 through the model. Platform format, size and media-configuration limits still apply. Plain UTF-8 and BOM-marked UTF-16 documents include bounded text excerpts; truncated excerpts are explicitly marked and the original file remains available.

## Available channels

All channels default to the owner's private conversation. Lark, Telegram and Discord may explicitly opt into protected groups/topics. Replies return to the original conversation.

| Channel | Receive | Reply |
| --- | --- | --- |
| Feishu / Lark | Text, images, audio, files | Text, images, audio, files |
| Official QQ bot | Text, images, audio, files | Text, images, native voice, files |
| DingTalk | Text, images, audio, files | Text, images, AMR voice, files |
| WeCom smart bot | Text, images, files; platform transcript for voice | Text, images, AMR voice, files |
| Weixin iLink | Text, images, audio, files | Text, images, native voice, files |
| Discord | Text, images, audio, files | Text, images, playable audio attachments, files |
| Telegram | Text, images, audio, files | Text, images, voice, files |
| LINE | Text, images, audio, files | Text; images and audio after explicitly configuring temporary media delivery |

## Interaction capabilities

See [chat features](docs/channel-experience.en.md) for buttons, long answers, albums and reminder management.

| Capability | Lark | QQ | Weixin iLink | Telegram | Discord |
| --- | --- | --- | --- | --- | --- |
| Processing feedback | Reactions/status card | Native input notice | Official typing | Reaction/typing | Reaction/typing |
| Progressive replies | Same card | Native stream | Not offered | Edit one message | Edit one message |
| Recent context | Yes | Yes | Yes | Yes | Yes |
| Group/topic rules | Opt-in | Owner private | Owner private | Opt-in | Opt-in |
| Owner chat commands | Yes | Yes | Yes | Yes | Yes |

New groups stay disabled. Protected per-channel policy controls feedback, genuine progressive updates and long-text parts. See [shared interactions](docs/new-channels.en.md#shared-interaction-and-group-rules) for configuration and hosted-dot control boundaries.

Owner DMs support `/status`, `/queue`, `/subscription`, and `/cancel [reference]` for local bridge work. The shared runtime separates final delivery status from the typing lease: beginning work still needs one final reply. Hosted-dot pause/reset/approval remain in the original platform.

See [channel setup and limits](docs/new-channels.en.md) for formats and size limits. Audio understanding depends on the dot host. Tools keep original audio and reference transcripts distinct. Optional local Whisper requires a protected Linux runtime.

Lark media requires the corresponding interaction policy and app permissions; follow the component's configuration guide.

DingTalk, WeCom, Weixin, Discord and Telegram default to a complete text file above native single-message limits. Telegram/Discord can opt into durably acknowledged native parts. LINE splits long text within one reply request; media hosting remains disabled until configured, and generic file messages are not available. Audio replies use existing recordings, without automatic speech synthesis.

## Install

Use **Node.js >=24.15 and <25** on a continuously available computer or VPS. Windows supports foreground operation and Linux provides systemd. A deployment computer can disconnect while the remote service continues. macOS is unverified; trials and feedback are welcome.

Windows also needs an existing Python 3 interpreter for private-file ACL checks. Set `DOT_BRIDGE_PYTHON` to its absolute path as described in [operations](docs/operations.en.md#windows-private-files).

```bash
git clone https://github.com/Arcueid77/dot-bridge.git
cd dot-bridge
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm run bridge -- channels
npm run bridge -- guide --channels telegram
```

Pinned component artifacts are included, so no sibling source checkouts are needed. This is a source installation, not a published npm registry package.

## Connect existing configuration

Keep your paired credentials, keys, databases and original event subscriptions. Stop the previous corresponding consumers before starting the unified entry point. Run checks and foreground operation as the final runtime user:

```bash
npm run bridge -- init --config ./bridge.json --mode live --channels lark,qq --env-dir /var/lib/dot-bridge/private --data-dir /var/lib/dot-bridge
npm run bridge -- doctor --config ./bridge.json
npm run bridge -- run --config ./bridge.json --confirm-live
```

Choose `--channels lark` for Lark alone. Omitted channels need no credentials and start no consumers. `init` creates a path-only manifest; it does not generate credentials or overwrite an existing manifest. Edit an existing manifest directly.

Press **Ctrl+C** to stop foreground operation. See [operations](docs/operations.en.md) for first-time pairing, persistent services, updates and rollback.

```bash
npm run bridge -- status --config ./bridge.json
npm run bridge -- service render --config ./bridge.json --output ./systemd-output
sudo node bin/dotbridge.js service start --config ./bridge.json --confirm-live
sudo node bin/dotbridge.js service stop --config ./bridge.json
sudo node bin/dotbridge.js service restart --config ./bridge.json --confirm-live
sudo node bin/dotbridge.js service status --config ./bridge.json
```

`guide` shows platform setup steps. `doctor` checks installed components and protected configuration. `status` reports authenticated catalogs, gateway and subscription states separately, plus recent redacted subscription failures where available. Real delivery also requires the official Tunnel and a valid original-dot subscription.

## Local management

Open a local dashboard for channel status, owner pairing guidance, original-dot subscriptions, configuration checks, and upgrade preparation:

```bash
node bin/dotbridge.js ui --config /var/lib/dot-bridge/bridge.json
```

Open the loopback URL printed by the command. Use `ui --demo` for a synthetic, account-free preview. The dashboard does not accept credentials, start another consumer, create subscriptions, or execute a target release. Configuration saves retain a private backup and take effect after an administrator reviews and restarts services. See the [management guide](docs/management.en.md).

## Independent components

| Repository | Responsibility |
| --- | --- |
| This distribution | Installation, selected channels, services and pinned composition |
| [dot-bridge-core](https://github.com/Arcueid77/dot-bridge-core) | Shared transport, private storage, protocol/router and processing |
| [dot-lark-bridge](https://github.com/Arcueid77/dot-lark-bridge) | Feishu/Lark |
| [dot-qq-bridge](https://github.com/Arcueid77/dot-qq-bridge) | Official QQ bot |
| [dot-dingtalk-bridge](https://github.com/Arcueid77/dot-dingtalk-bridge) | DingTalk |
| [dot-wecom-bridge](https://github.com/Arcueid77/dot-wecom-bridge) | WeCom smart bot |
| [dot-weixin-bridge](https://github.com/Arcueid77/dot-weixin-bridge) | Weixin iLink |
| [dot-discord-bridge](https://github.com/Arcueid77/dot-discord-bridge) | Discord |
| [dot-telegram-bridge](https://github.com/Arcueid77/dot-telegram-bridge) | Telegram |
| [dot-line-bridge](https://github.com/Arcueid77/dot-line-bridge) | LINE Messaging API |

The `channels` command lists installed adapters. The [roadmap](docs/im-roadmap.en.md) separates implementation, account onboarding and release acceptance. [Development](docs/development.md) covers source versions and packaging.

## Scheduled messages

Explicit `DOT_BRIDGE_OUTBOUND=owner-text` enables owner-only text and fixed reminders per channel. Dynamic reports are generated by the original dot's saved tasks. QQ also implements this path; verify the account's platform eligibility and quota before activation. Explicit rejection pauses the intent as `rejected`; ambiguous results remain `uncertain`. See [scheduled messages](docs/scheduled-messages.en.md).
