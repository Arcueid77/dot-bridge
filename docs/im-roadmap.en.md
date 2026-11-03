# Roadmap to 1.0

[中文](im-roadmap.md)

Proposed plan based on unified distribution 0.8.0, dated 2026-11-03. Advance by acceptance gates. Implementation and release evidence belong in [development notes](development.md).

## What 1.0 delivers

A stable self-hosted product that external users can install from scratch, connect to their own IM accounts and original dot, operate continuously, upgrade, back up, restore, and migrate. Keep the existing independent providers → shared core → aggregate router → official Secure MCP Tunnel → original dot architecture.

Start with GitHub Releases, immutable source versions, and verifiable release archives. Decide npm registry distribution separately; retain `private: true` until the npm installation and dependency design passes acceptance.

Secure MCP Tunnel supports private MCP connections. Public plugin submission requires a stable public HTTPS MCP endpoint. Treat store submission as a separate project; the current 1.0 plan retains private Tunnel connections. [Official distribution boundary](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)

Check the target account/workspace's custom MCP access and Tunnel roles at the beginning of setup. Runtime credentials use Tunnels Read + Use; creation/management privileges are handled separately. [Official access requirements](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels#permissions-and-access)

## Existing foundations and gaps

| Area | Existing foundation | Required for 1.0 |
| --- | --- | --- |
| Eight channels | Pinned component packages, unified CLI, synthetic tests, owner-chat protocols | Real account, original-dot subscription, actual delivery, and restart acceptance for every channel |
| Local management | Setup guides, layered state, configuration checks, channel selection, upgrade runbooks | Connected onboarding, protected credential handoff, persistent operation, and maintenance actions |
| Owner notifications | Text, durable reminders, deduplication, cancellation, uncertain-result protection | Separate implementation support, account verification, opt-in, and latest platform outcome |
| Weixin proactive delivery | Independent request without a cached context token implemented | Current test account rejects the request; keep the feature disabled and show sanitized diagnostics |
| Operations | Linux systemd, private-file checks, version locks, cutover records | Complete selected-channel backup/restore, migration rehearsal, Windows persistence, and sustained acceptance |
| Continuous validation | CI for core, QQ, Lark, and the distribution | Independent CI for the six remaining providers and clean-machine acceptance of each release archive |

## 1.0 scope

- Complete real owner-private-chat acceptance for Lark, QQ, DingTalk, WeCom, Weixin iLink, Discord, Telegram, and LINE. Install and enable only the channels selected by the user.
- Track images, original audio, transcripts, file reads, media replies, streaming updates, proactive sending, and reminders separately. Enable features according to actual platform permissions and verification.
- Regress Lark's existing group controls: member allowlists/all members, real mentions, keyword/all-message triggers, and original-conversation replies. Schedule other providers' group extensions separately.
- Qualify Linux x64 and Windows x64. Provide Linux systemd operation and complete Windows persistent operation and exit behavior. Label macOS unverified; welcome trials and feedback.
- Keep the same dot, existing Tunnel, and original-conversation routing as the default. Manage source, configuration, data, and personal credentials separately.

## Milestones

| Stage | Goal | Deliverables | Exit gate | Initial effort |
| --- | --- | --- | --- | --- |
| 0.8.x | Finish existing functionality | Eight-channel live acceptance, accurate capability/diagnostic states, protocol regressions | All basic private chats pass; every advanced feature has an accurate state | 3–5 working days, excluding account waits |
| 0.9.0 | External users can deploy and maintain it | Onboarding, persistent operation, coordinated upgrades, complete backup/restore, CI | Clean Linux/Windows setup follows the docs; restore and rollback rehearsals pass | 7–10 working days |
| 1.0.0-rc | Feature freeze and external trials | Sustained operation, real lease renewal, fresh-user installation feedback | At least seven observation days plus renewal, fault, and recovery acceptance | 7–14 calendar days |
| 1.0.0 | Stable release | Stable tags, archives, verification data, bilingual documentation, maintenance policy | All release gates pass and release approval is complete | 1–2 working days |

Estimate roughly 4–6 weeks for one developer with an Agent, excluding platform account and approval waits. CI, documentation, installation, and recovery tooling can proceed while accounts are pending.

## 0.8.x: finish and represent capabilities accurately

| Work | Owning repositories | Acceptance |
| --- | --- | --- |
| Finish Discord, DingTalk, WeCom, and LINE onboarding | Providers, distribution | Correct owner binding, real original-dot subscription, and one actual reply in each original private chat |
| Complete LINE HTTPS ingress | LINE, deployment tooling | Signature verification, official webhook verification, certificate renewal, and scoped ingress pass; MCP remains loopback-only |
| Calibrate capability states | Core, providers, distribution | Display implementation, opt-in, account verification, explicit rejection, and unknown outcomes separately; show the current Weixin refusal |
| Complete conversation feedback | Providers, core | Processing indicators terminate correctly, supported updates work, long answers remain complete, and quotes/replies stay in their conversation |
| Cover critical failure paths | Core, providers | Reproducible tests for batches/bursts, duplicate events, disconnects, expiry, restart, invalid credentials, and explicit rejection |
| Align installation entry points and versions | Distribution, providers | README, stable tags, default-branch instructions, and downloads identify one verifiable release composition |

Enable independent Weixin proactive delivery only after an official viable path and real account acceptance. Retain ordinary messaging and cross-channel reminders initiated from Weixin.

## 0.9.0: connect existing tools into a complete workflow

1. **Onboarding:** extend the existing local UI and CLI through account eligibility, dependency checks, platform application setup, protected credential handoff, owner pairing, original-dot subscription, and actual message confirmation. List required permissions and human steps together.
2. **Persistent operation:** provide inspect/start/stop/recover actions for Linux and Windows. Define behavior after terminal closure, user logout, and machine restart. Separate the deployment computer from the runtime host.
3. **Upgrade and rollback:** verify component/catalog compatibility, inspect outstanding work, back up, switch, and check state. Recover the previous compatible code/configuration while retaining newly received data, deduplication, and send outcomes. Freeze the 1.0 manifest, CLI, MCP schemas/errors, and data-migration contracts.
4. **Complete backup/migration:** enumerate every selected channel, database, key, pairing, subscription, original Tunnel profile, and required TLS state from the manifest. Extend the historical two-channel backup tooling and rehearse encrypted export, isolated restore, and host cutover.
5. **Diagnostics:** show gateway state, original-dot subscription and expiry, latest delivery, and queues. Record fixed error categories and sanitized platform error codes. The original dot/platform renews subscriptions; the bridge shows expiry, failure reasons, and recovery guidance. Cover expired accounts, low disk, and overload.
6. **Release engineering and docs:** continuously validate all ten repositories and test the actual installed eight-provider composition. Align Chinese/English installation, management, troubleshooting, backup/restore, capability, and Agent deployment guides. Review third-party licensing and client distribution.

Retain explicit confirmation for consequential actions and continue ordinary diagnostics and reversible preparation. Integrate credentials, pairing, and real subscription steps through protected workflows. Keep management on loopback.

## 1.0.0-rc: freeze features and validate sustained operation

- At least two testers uninvolved in implementation complete documented clean Linux/Windows installs. Classify feedback as installation, platform access, subscription, or product defects.
- Qualify real private chats, consecutive messages, long answers, and advertised media features for every channel. Test proactive sends and reminders only for verified eligible channels.
- Observe at least seven continuous days and at least one real renewal for every supported subscription type. Extend observation or use a controlled lease rehearsal when a lease exceeds the window.
- Rehearse gateway/Tunnel outages, process crashes, network timeouts, expiry, disk exhaustion, and failed upgrades. Run full-host restart acceptance during an approved maintenance window.
- Rehearse clean-host restore and single-consumer migration. Preserve original storage keys, bindings, queues, deduplication, subscriptions, and uncertain outcomes.
- Measure eight-channel operation and media resource use, publish recommended capacity, and accept only defect fixes or necessary compatibility fixes during RC.

## Stable release gates

P0 includes credential exposure, unauthorized/cross-chat delivery, corruption of acknowledged state, and automatic resends of uncertain messages. P1 includes broken basic onboarding, messaging, subscription renewal, or recovery when documented platform prerequisites are met.

- [ ] All eight basic private-chat live acceptance records pass; the published matrix matches results.
- [ ] No unresolved P0/P1 defects, cross-chat delivery, unauthorized replies, or automatic resends of uncertain messages.
- [ ] Linux/Windows clean install, persistent operation, restart, upgrade, rollback, and complete restore pass.
- [ ] Real subscription expiry/renewal and sustained-operation acceptance pass.
- [ ] Every component has immutable SHA/version/digests; required CI and final archive checks pass.
- [ ] Bilingual setup/troubleshooting/capability/maintenance docs and third-party release licensing review are complete.

Build stable tags from verified `main` commits. Use the project's Squash PR flow; release core and provider artifacts before pinning the distribution. Providers keep independent versions. Publish digests, component/dependency inventories, release notes, known limits, and rollback instructions, and verify build provenance and third-party licensing. Keep production credentials on the runtime host.

## Human involvement

Account owners handle sign-in, QR/OTP checks, organization permissions, application and persistent-credential approvals, owner pairing, and domain/certificate/ingress approval. Original-dot subscriptions use callbacks from the real host flow.

The Agent prefers CLI, APIs, SSH, and files for setup, checks, packaging, and rehearsals. Obtain scoped authorization when Computer Use is necessary. Provide official manual steps and secure handoff when an automation tool cannot access a console. Use ordinary private-chat test messages and consolidate human verification.

## Later 1.x candidates

Schedule other providers' groups/channels/topics, optional text-to-speech, more document formats, and additional architectures by demand. Treat multi-user hosted service, public plugin-store submission, complete feature parity, and a new wave of IM providers as separate projects.

<details>
<summary>Existing transports and future platform research</summary>

The existing research baseline is [cc-connect](https://github.com/chenhg5/cc-connect/tree/2dec7173bdd44ec598c3c7e5c7ff00407acfdedf/platform), reviewed 2026-10-19. Its IM-side transports are a reference; DotBridge retains the original dot and official Tunnel/event integration.

| Provider | Transport | Platform setup |
| --- | --- | --- |
| DingTalk | Stream/WebSocket | Application permissions, owner pairing, message/reply credentials |
| WeCom | Intelligent robot WebSocket | Eligible administrator, API long-connection robot; separate from a send-only group webhook |
| Weixin iLink | QR login and long polling | Account login, durable cursor, media, conversation context |
| Discord | Gateway WebSocket | Bot installation, DM/member authorization, required intents |
| Telegram | Bot API long polling | Bot token, owner allowlist, durable cursor, attachments |
| LINE | Messaging API webhook | Public HTTPS, signatures, reply-token lifetime |

Lark/QQ/core/provider repositories remain independent and the distribution pins reviewed packages. A new channel needs its provider implementation, shared-core reuse, component/management integration, real original-dot/private-chat/restart acceptance, and then inclusion in the supported distribution.

Future research candidates include Matrix (homeserver/device credentials and E2EE state) and Google Chat (Cloud project, Pub/Sub, service account/IAM). Other research directories include Weibo, WPS/AgentSpace, Webex, MAX, Yuanbao, and Tuitui. `cloud-web` is a web surface rather than an IM provider. Prefer existing official dot support for Slack.

Platform tokens and the Tunnel runtime key have separate purposes. QQ personal-account OneBot/NapCat is a separate integration from the official QQ bot.

</details>
