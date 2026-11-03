# Installation and operation

## Initial setup

Use Node.js >=24.15 and <25. Pair each channel using its existing component flow:

- [Lark configuration](https://github.com/Arcueid77/dot-lark-bridge)
- [QQ configuration](https://github.com/Arcueid77/dot-qq-bridge)
- [DingTalk, WeCom, Weixin iLink, Discord, Telegram and LINE setup](new-channels.md)

The distribution reads protected configuration and preserves the original dot. It does not perform pairing or create credentials. Examples contain paths and placeholders only. Use separate service keys for the aggregate and each enabled backend. Store private files outside the repository under the final runtime user: 0700 directories and 0600 files on Linux, private ACLs on Windows.

The manifest can live outside the checkout, for example `/var/lib/dot-bridge/bridge.json`. `init` never overwrites an existing manifest. The manifest selects channels; the aggregate derives upstream ports and key references from their environment files.

Under `dataDirectory`, each channel owns its own database directory, named after its channel ID, and all use `locks/`. Private configuration belongs in a separate `private/` directory. Run `doctor` and foreground operation as the same user that will own the service.

## Windows private files

Select an existing Python 3 interpreter in the PowerShell session used for checks and foreground operation:

```powershell
$env:DOT_BRIDGE_PYTHON = (Get-Command python.exe).Source
& $env:DOT_BRIDGE_PYTHON --version
```

The command must print a real Python 3 version, not invoke a Microsoft Store installation placeholder. An explicit absolute `python.exe` path is also accepted. Child processes preserve this choice and keep the ACL checks enabled.

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

`guide --channels telegram` shows setup steps without reading credentials. `status` checks authenticated catalogs and reports each channel's binding, gateway and subscription separately. Unknown fields remain null. An unreachable backend does not hide other channel results. `service status` reports selected systemd units.

The six generic channels retain the last five subscription attempts as encrypted, redacted diagnostics: time, phase, RPC code, fixed reason and hostname. No callback path, secret or message text is returned. Empty history cannot reconstruct older failures. A policy error requires checking the actual callback host; a transport error concerns the host's network policy; a challenge error means verification did not finish. Do not repeatedly create subscriptions. These channels use `CALLBACK_HOSTS`; existing Lark/QQ configuration uses `MCP_CALLBACK_ALLOWED_HOSTS`.

Foreground output contains lifecycle state rather than raw SDK diagnostics. Generated systemd units use the host's default journal retention; a dedicated namespace and retention policy are an administrator choice and are not copied from an old VPS.

The runtime host can fetch the distribution directly from GitHub. The repository includes pinned core/provider artifacts. Keep configuration, credentials, databases, and subscription state outside the checkout.

Use a Git cache and one detached worktree per reviewed full commit SHA. The deployment administrator initializes the cache once:

```bash
git init --bare --initial-branch=main /opt/dot-bridge/repository.git
git --git-dir=/opt/dot-bridge/repository.git remote add origin https://github.com/Arcueid77/dot-bridge.git
git --git-dir=/opt/dot-bridge/repository.git config remote.origin.fetch '+refs/heads/main:refs/remotes/origin/main'
git --git-dir=/opt/dot-bridge/repository.git config --add remote.origin.fetch '+refs/heads/main:refs/heads/main'
```

For each deployment, replace the example `BRIDGE_REV` with a reviewed full SHA. The new release directory must not exist:

```bash
BRIDGE_REV=0d12db9b1eeda4ce82dd72df548717acdf9551e4
BRIDGE_GIT_CACHE=/opt/dot-bridge/repository.git
BRIDGE_RELEASE=/opt/dot-bridge/releases/git-$BRIDGE_REV
git --git-dir="$BRIDGE_GIT_CACHE" -c http.sslVerify=true fetch --depth=1 --no-tags origin main
git --git-dir="$BRIDGE_GIT_CACHE" -c http.sslVerify=true fetch --depth=1 --no-tags origin "$BRIDGE_REV"
git --git-dir="$BRIDGE_GIT_CACHE" update-ref "refs/releases/$BRIDGE_REV" "$BRIDGE_REV"
git --git-dir="$BRIDGE_GIT_CACHE" worktree add --detach "$BRIDGE_RELEASE" "$BRIDGE_REV"
```

Install dependencies in the new directory with a dedicated writable npm cache. The installation user needs write access during staging; make source and `node_modules` read-only to the runtime user afterward. Keep private data owned by the final service user. Run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`, `npm run check`, `npm test`, and `doctor` as that user.

After checks pass, inspect outstanding work, gracefully stop affected consumers and the aggregate, take SQLite-consistent backups, and preserve existing unit definitions. Update effective systemd commands to the new release, reload definitions, start services, and verify authenticated catalogs, gateways, and original subscriptions. Inspect both `ExecStart` and `DropInPaths` when overrides exist. Keep omitted channels inactive and preserve the existing official Tunnel instance/profile. Normal systemd operation uses signals rather than the foreground supervisor's stdin switch.

Keep the running checkout pinned to its SHA; later fetches prepare another release directory. Roll back to the previous compatible code/dependencies and preserved service definitions while retaining current databases, original storage keys, sent outcomes, and uncertain state without automatic resend.

Before downgrading to a version without media replies, check for pending, processing or uncertain media jobs. Preserve the current version or stop for review while those jobs exist; do not delete the queue, rewrite outcomes or resend an encoded media plan as text.

Media and group capabilities follow channel policy and dot capabilities. Official QQ bots and personal-account OneBot/NapCat integrations are distinct; this distribution uses the official bot route.
