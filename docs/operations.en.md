# Installation and operation

## Initial setup

Use Node.js >=24.15 and <25. Pair each channel using its existing component flow:

- [Lark configuration](https://github.com/Arcueid77/dot-lark-bridge/blob/686347bb83263edb9e1149c7fe1a4b323f2d5e4f/docs/configuration.en.md)
- [QQ configuration](https://github.com/Arcueid77/dot-qq-bridge/blob/b6c24d2021a4dcf6eec1e154b61ce61252fef2cf/docs/configuration.en.md)

The distribution reads protected configuration and preserves the original dot. It does not perform pairing or create credentials. Examples contain paths and placeholders only. Use separate service keys for the aggregate and each enabled backend. Store private files outside the repository under the final runtime user: 0700 directories and 0600 files on Linux, private ACLs on Windows.

The manifest can live outside the checkout, for example `/var/lib/dot-bridge/bridge.json`. `init` never overwrites an existing manifest. The manifest selects channels; the aggregate derives upstream ports and key references from their environment files.

Under `dataDirectory`, each channel owns its `lark/` or `qq/` database directory and both use `locks/`. Private configuration belongs in a separate `private/` directory. Run `doctor` and foreground operation as the same user that will own the service.

## Tunnel and subscriptions

Use the [official Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) client and its supported configuration format. Keep one client instance for the existing Tunnel. Point its HTTP MCP target to the aggregate, for example `http://127.0.0.1:8789/mcp`, and reference the aggregate service-key file for `X-Dot-Bridge-Service-Key`.

Actual command-line arguments and `file:` support must match the installed official client. The distribution does not generate runtime keys, private profiles or callback URLs. Refresh the existing plugin catalog and let the original dot establish or renew its actual subscriptions. Local health does not prove end-to-end delivery; verify a real owner private message and its reply.

Subscriptions expire. The original dot/platform must renew before `refreshBefore`; restarting the bridge does not extend them.

## Migration

Keep existing pairing, storage keys, databases and subscriptions. Run `doctor` against their protected environment files. Drain unfinished work and stop the previous consumers before starting the distribution. Cross-host migration requires explicit confirmation that the old host stopped. If moving SQLite, use a consistent backup or a complete stopped backup, including the original storage key. Preserve sent and uncertain outcomes without replaying them.

## Linux persistent services

Install the distribution in a runtime-readable location protected against runtime writes. Prepare a dedicated non-root user, private configuration and writable channel/lock directories. On the final Linux host:

```bash
node bin/dotbridge.js service render --config /var/lib/dot-bridge/bridge.json --output ./systemd-output
```

The output directory must be new. Review the generated units before installation. They use absolute paths, the configured runtime user, failure restart, a 180-second stop grace, ordinary signal shutdown and restricted writes. Back up and plan a cutover for existing units with the same names; do not overwrite a running installation casually.

For a new installation:

```bash
sudo install -m 0644 systemd-output/*.service systemd-output/*.target /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dot-bridge.target
sudo node bin/dotbridge.js service start --config /var/lib/dot-bridge/bridge.json --confirm-live
```

This controls selected backends and the aggregate. The official Tunnel keeps its own configured service. An optional `systemd.tunnelUnit` adds an existing Tunnel service as a startup dependency; that unit still defines its own stop relationships. Prefixes can distinguish independent installations, but each must have separate ports, bindings, credentials and data. Never run duplicate consumers for one app binding.

## Status, logs and upgrades

`status` checks authenticated local catalogs. `service status` reports selected systemd units. Foreground output contains lifecycle state rather than raw SDK diagnostics. Generated systemd units use the host's default journal retention; a dedicated namespace and retention policy are an administrator choice and are not copied from an old VPS.

Stop before changing dependencies, preserve the previous code and `node_modules`, switch to a reviewed distribution revision, run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`, run `doctor` as the runtime user, then start services. Credentials and data stay outside the checkout. Roll back code/dependencies only after checking database compatibility; never overwrite new messages with an old database snapshot. Regenerate units if absolute installation paths change.

Media and group capabilities follow channel policy and dot capabilities. Official QQ bots and personal-account OneBot/NapCat integrations are distinct; this distribution uses the official bot route.
