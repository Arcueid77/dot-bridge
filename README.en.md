# DotBridge

Connect your chat apps to your existing ChatGPT dot. Send a message from your familiar chat app and let the same dot handle it and reply.

This repository is the unified installation and operations entry point. Select Lark, QQ, DingTalk, WeCom, Weixin iLink, Discord, Telegram or LINE as needed. Each channel remains maintained in its own repository.

[简体中文](README.md) · [Operations](docs/operations.en.md) · [IM candidates](docs/im-roadmap.md)


Received attachments can be reused by their source-message index, without copying Base64 through the model. Platform format, size and media-configuration limits still apply. Plain UTF-8 and BOM-marked UTF-16 documents include bounded text excerpts; truncated excerpts are explicitly marked and the original file remains available.

## Available channels

All channels are bound to the owner's private conversation. Replies return to that conversation.

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

See [channel setup and limits](docs/new-channels.md) for formats and size limits. Audio understanding depends on the dot host. A transcript is a reference, not proof of native audio understanding. Optional local Whisper requires a protected Linux runtime.

Lark media requires the corresponding interaction policy and app permissions; follow the component's configuration guide.

DingTalk, WeCom, Weixin, Discord and Telegram deliver an answer as a complete text file when it exceeds the platform's single-message text limit. LINE splits long text within one reply request; media hosting remains disabled until configured, and generic file messages are not available. Audio replies use existing recordings, without automatic speech synthesis.

## Install

Use **Node.js >=24.15 and <25**. Foreground operation supports Windows and Linux; persistent services use Linux/systemd.

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

Open the loopback URL printed by the command. Use `ui --demo` for a synthetic, account-free preview. The dashboard does not accept credentials, start another consumer, create subscriptions, or execute a target release. Configuration saves retain a private backup and take effect after an administrator reviews and restarts services. See the [management guide](docs/management.md).

## Independent components

- [dot-lark-bridge](https://github.com/Arcueid77/dot-lark-bridge): Feishu/Lark.
- [dot-qq-bridge](https://github.com/Arcueid77/dot-qq-bridge): QQ.
- [dot-bridge-core](https://github.com/Arcueid77/dot-bridge-core): shared transport, MCP routing, private files and transcription.

New IM implementations get independent repositories and are then added to this distribution. The `channels` command lists what can actually start. Packaging and testing details are in [development](docs/development.md).
