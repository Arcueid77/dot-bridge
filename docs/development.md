# Development and release composition

The distribution consumes independent component releases. It owns the CLI,
selected-channel composition, operator configuration, foreground lifecycle,
systemd rendering, and compatibility checks. Provider behavior remains in the IM
repositories; transport and security primitives remain in core.

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

The six new providers use core 0.4.x encrypted channel runtime. Platform protocol fixtures live in each independent repository. `multi-channel.test.js` starts all eight actual packaged readiness backends and checks their authenticated catalogs without sibling source checkouts. `channel-runtime.test.js` in core exercises signed callback challenge, owner binding, encrypted state, uncertain sends, restart persistence, subscriptions and the actual router.

Platform priorities are documented in `im-roadmap.md`. cc-connect is a research
reference for platform transports; its model/agent runtime and platform code are
not vendored by this repository.
