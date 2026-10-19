# DotBridge

Connect Feishu/Lark and QQ to your existing ChatGPT dot. Send a message from your familiar chat app and let the same dot handle it and reply.

This repository is the unified installation and operations entry point. Enable Lark, QQ, or both. Each channel remains maintained in its own repository.

[简体中文](README.md) · [Operations](docs/operations.en.md) · [IM candidates](docs/im-roadmap.md)

## Available channels

| Channel | Usage |
| --- | --- |
| Feishu / Lark | Private text, images, files and transcribed voice; additional interactions follow the Lark component's policy |
| Official QQ bot | Owner private text and transcribed voice |

Voice is available through transcription. Native audio input depends on the dot host. Local Whisper transcription requires an additional protected Linux runtime; QQ reference transcription can be used directly when available.

## Install

Use **Node.js >=24.15 and <25**. Foreground operation supports Windows and Linux; persistent services use Linux/systemd.

```bash
git clone https://github.com/Arcueid77/dot-bridge.git
cd dot-bridge
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm run bridge -- channels
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

`doctor` checks installed components and protected configuration. `status` checks authenticated local MCP catalogs. Real delivery also requires the official Tunnel, a valid original-dot subscription and the channel connection.

## Independent components

- [dot-lark-bridge](https://github.com/Arcueid77/dot-lark-bridge): Feishu/Lark.
- [dot-qq-bridge](https://github.com/Arcueid77/dot-qq-bridge): QQ.
- [dot-bridge-core](https://github.com/Arcueid77/dot-bridge-core): shared transport, MCP routing, private files and transcription.

New IM implementations get independent repositories and are then added to this distribution. The `channels` command lists what can actually start. Packaging and testing details are in [development](docs/development.md).
