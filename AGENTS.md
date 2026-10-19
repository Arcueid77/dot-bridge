# Repository scope

This is the distribution and operations repository. Provider behavior belongs in
the independent dot-<channel>-bridge repositories; common protocol,
transport and private-file code belongs in dot-bridge-core. Consume reviewed
immutable packages instead of forking their implementation here.

- Keep `components.lock.json`, package hashes and the npm lockfile consistent.
- Rebuild vendored artifacts from committed source, never from a private runtime
  checkout or a working directory containing untracked files.
- Ordinary checks use synthetic private files and provider-disabled readiness
  services. Do not connect real IM accounts or create subscriptions during tests.
- Live startup requires explicit operator confirmation and existing protected
  configuration. Never create or print credentials as a convenience fallback.
- User documentation explains installation, operation and troubleshooting.
  Development evidence and release details belong in `docs/development.md`.
- Run `npm run check` and `npm test` for changes to startup or release packaging.
