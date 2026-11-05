# Local management UI

[中文](management.md) · [English](management.en.md)

Inspect eight-channel setup progress, pairing guidance, subscriptions, the next startup selection and upgrade preparation in a loopback browser UI. Prepare configuration through [operations](operations.en.md), then run as the final service account:

```sh
node bin/dotbridge.js ui --config /var/lib/dot-bridge/bridge.json
```

Open the printed local URL, normally `http://127.0.0.1:5399`. Closing the page leaves bridge services running; Ctrl+C stops the UI process. Windows uses its own manifest path. An account-free preview is available with `ui --demo`; use `--port 5400` or `--port 0` when needed.

## Connection stages

| Stage | Next step |
| --- | --- |
| Not selected | Choose the channel for the next startup if required |
| Configuration incomplete | Check private files and the runtime account |
| Service unavailable | Check the corresponding local backend |
| Pairing required | Complete owner confirmation in the private terminal |
| Platform disconnected | Check login, egress and the old consumer |
| Dot subscription required | Reuse or establish the original dot's valid event task |
| Subscription near expiry/expired | Let the original dot renew and inspect its actual expiry |
| Chain ready | Verify one owner DM reaches the original dot and returns once |

Missing fields in older components remain unknown. Existing bindings should be preserved; an offline service's unknown binding state needs investigation before another pairing attempt.

## Pairing and subscriptions

Follow platform application → owner pairing → original-dot subscription → owner DM confirmation. QR codes, temporary phrases, tokens and private identities stay in the private terminal/files. The UI provides setup instructions and redacted subscription stages. A new callback hostname is approved through the established security procedure using the real subscription's exact hostname.

LINE media additionally needs an approved temporary HTTPS download service. Enable it only after its domain, independent key and route are prepared.

## Save the next startup selection

Check the selected configuration first. Saving rechecks it and keeps a private manifest backup. It preserves runtime mode, data paths and existing private references. An administrator reviews the choice and restarts through the existing service procedure; channel changes also require reviewing regenerated units.

Concurrent manifest changes cause a conflict instead of an overwrite. Resolve ownership and private-file/link checks under the final runtime user.

## Prepare an upgrade

```sh
node bin/dotbridge.js ui --config /var/lib/dot-bridge/bridge.json --releases-dir /opt/dot-bridge/releases
```

Choose a reviewed local release. The UI checks hashes, lockfiles, component changes, selected channels, Node and private configuration, then produces an upgrade runbook. Administrators perform source review, consistent backup, target checks and systemd cutover on the final host.

Inspect complete pending/processing/uncertain counts. Resolve or coordinate outstanding work before switching; preserve uncertain sends and all post-upgrade state. See [updates and rollback](operations.en.md#status-logs-and-upgrades).

## Use on a VPS

Keep the UI on loopback. An existing SSH connection can forward the same local port:

```sh
ssh -N -L 5399:127.0.0.1:5399 YOUR_EXISTING_SSH_TARGET
```

Open `http://127.0.0.1:5399` on the deployment computer. No public management listener or new Tunnel permission is required.
