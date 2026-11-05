# Channel setup and interactions

[简体中文](new-channels.md) · [English](new-channels.en.md)

The distribution includes pinned components for Lark, QQ, DingTalk, WeCom, Weixin iLink, Discord, Telegram and LINE. Install and run only selected channels. Credentials, storage keys, databases and the original dot's real subscriptions remain private to the runtime host.

## Platform preparation

| Channel | Prerequisite and transport |
| --- | --- |
| DingTalk | An enterprise application with a Stream bot and a protected owner binding |
| WeCom | A smart bot supporting long connections, its Bot ID/Secret and verified owner pairing |
| Weixin iLink | Official QR login and owner binding, followed by long polling |
| Discord | An official Bot application, bot token and the exact owner DM; Gateway WebSocket |
| Telegram | A BotFather bot and verified owner pairing; Bot API long polling |
| LINE | A Messaging API channel, channel access token/secret, verified owner and approved public HTTPS webhook ingress |

Follow each component's platform setup. Keep existing verified credentials when upgrading; stop any old consumer before moving the same account to another host. QQ/Lark component guides cover their established application pairing flows.

## Protected configuration and startup

Use Node.js >=24.15 and <25. A channel environment file contains protected file paths, not values to paste into a chat:

```dotenv
AUTH_MODE=tunnel-service
BRIDGE_MODE=tunnel
TUNNEL_SERVICE_OPERATION=live
TUNNEL_SERVICE_OWNER_ID=tunnel-owner:dot-bridge
HOST=127.0.0.1
PORT=8794
TUNNEL_SERVICE_KEY_FILE=/var/lib/dot-bridge/private/telegram/service.key
TELEGRAM_CREDENTIALS_FILE=/var/lib/dot-bridge/private/telegram/credentials.json
STORAGE_KEY_FILE=/var/lib/dot-bridge/private/telegram/storage.key
DATABASE_PATH=/var/lib/dot-bridge/telegram/bridge.sqlite
BRIDGE_LOCK_DIRECTORY=/var/lib/dot-bridge/locks
CALLBACK_TRANSPORT_MODE=standard
CALLBACK_HOSTS=REPLACE_WITH_VERIFIED_SUBSCRIPTION_HOST
```

Use the actual available port and matching channel environment prefix. Private directories require mode `0700`; files require `0600`, owned by the final runtime user. On Windows use the documented private ACLs. Symbolic/hard links and weaker permissions are refused. Each channel and aggregate use independent service keys; keep the original storage key with its encrypted state.

Select channels in the manifest, inspect them with `doctor`, and start with `--confirm-live`. See [installation and service operations](operations.en.md). MCP listeners stay on loopback. LINE additionally needs the separately approved HTTPS ingress, signature verification and certificate maintenance.

Refresh the existing Tunnel plugin's tools, then ask the same original dot to inspect/reuse its `<channel>.message.created` task. The real subscription supplies its callback and signing material. Configure only its approved exact hostname, preserving HTTPS, public DNS/IP checks, TLS and redirect refusal. A subscription grants at most seven days and returns `refreshBefore`; the host renews it. Inspect gateway, binding, subscription and actual delivery separately.

## Media and long replies

Media reads/replies are bounded to 5 MiB per attachment. Formats and captions vary by provider. Source-attachment replies reuse the original attachment by index. File excerpts explicitly mark truncation while preserving original bytes. PDF and Office extraction uses the protected Linux runtime described below. Raw audio, gateway transcription and optional local Whisper remain separate. Replies use existing audio bytes.

| Channel | Native text limit and reply notes |
| --- | --- |
| Weixin | 3800 characters; native voice or file/image, no media caption |
| Discord | 2000 characters; playable audio attachments, captions up to 2000 |
| Telegram | 4096 characters; JPEG/PNG and supported voice formats, captions up to 1024 |
| DingTalk | AMR voice up to 60 seconds; no extra media caption |
| WeCom | Supported image/file/AMR messages; no extra media caption |
| LINE | Its own multi-message request limits; optional approved media hosting for image/audio, no generic file reply |

The default long-answer policy sends a complete text file above a native text limit. Supported channels may opt into durable native chunks. One source message has one logical final reply; unknown sends are never automatically repeated.

## Shared interaction and group rules

For Telegram, Discord and Weixin, set `DOT_BRIDGE_INTERACTION_POLICY_FILE` to a separate protected JSON policy for the channel:

```json
{
  "version": 1,
  "feedback": {"enabled": true, "reaction": true, "typing": true, "streaming": true, "lease_seconds": 60},
  "context": {"max_messages": 20, "max_chars": 12000},
  "replies": {"long_text": "file"},
  "management": {"enabled": true},
  "groups": []
}
```

Receipt feedback follows durable admission. Reading a message or calling `begin_<channel>_reply` starts a bounded typing lease. Terminal outcomes and expiry clear feedback. Weixin uses official owner-bound typing tickets; it does not advertise unsupported reactions or progressive edits.

Telegram/Discord support `append_<channel>_reply` with genuinely generated full text so far. Sequence numbers start at one, increase consecutively, and identical retries are idempotent. `reply_to_<channel>` finalizes the acknowledged native progress message. Send the complete answer directly when there is no genuine incremental content.

`get_<channel>_context` reads retained messages preceding the source message, restricted to its conversation, topic and configured sender scope. Quotations and history remain untrusted data. Telegram Markdown becomes safe HTML; Discord retains native Markdown.

`long_text: "chunks"` persists the plan and every acknowledgement. An ambiguous part remains `uncertain`, including across restart. Earlier acknowledged parts are never automatically resent. The default remains `file`.

Telegram and Discord groups require explicit rules. Add a group/channel identifier only to the private policy:

```json
{
  "conversation_id": "REPLACE_WITH_GROUP_OR_CHANNEL_ID",
  "enabled": true,
  "members": "all",
  "mention": true,
  "auto_reply": "off",
  "reply_in_thread": true,
  "context_scope": "sender"
}
```

Choose `owner`, `allowlist`, or `all` for `members`; `allowlist` requires `allow_from`. `auto_reply` accepts `off`, `keywords`, or `all`; keyword mode requires `keywords`. Context defaults to the sender; choose `group` explicitly for shared group context. Private history stays separate.

Telegram verifies real mention entities, commands addressed to this bot and replies to it, retaining forum topic IDs. Unmentioned messages require appropriate BotFather privacy/admin settings. Discord verifies actual mentions and resolves existing forum threads through configured parent channels. It replies to the original channel/thread without automatically creating a new thread. Keyword/all-message rules require checking Message Content intent in the official console; the program does not change platform permissions.

Before enabling groups, update the existing original-dot event task to `conversation=configured`. `owner` receives owner-private events only. Reuse one task and its real subscription flow. Group-task instructions must prohibit reading or revealing private-chat memory.

## Protected document and audio runtime

PDF/Office extraction uses root-owned Linux Python, `pypdf`, `prlimit`, the packaged worker and `DOT_BRIDGE_AUDIO_GUARD`. Input/output, CPU, memory, archive entries and text/page limits are bounded. The worker reads pipes without extracting archives to the filesystem. Authorization is rechecked after processing. Without the protected runtime, retain the original file and supported plain-text excerpts.

Audio retains shared protected conversion, isolated SILK processing and optional local Whisper. Configure the documented trusted binaries/model and guard; no model API credential is created as a fallback.

## Maintenance from chat

The bound owner private chat accepts `/help`, `/status`, `/queue`, `/subscription`, and `/cancel [reference]`. References come from `/queue`; omitting one cancels the newest unsent reply in the current conversation. Inflight and uncertain deliveries are preserved.

Lark/QQ retain their established interaction policies. Explicit `DOT_BRIDGE_OWNER_MANAGEMENT=1` in standard callback mode keeps owner management connected without an active dot subscription. Ordinary owner messages then receive subscription status instead of being dispatched to a model. The existing subscription connection gate remains the default.

`/cancel` controls queued bridge replies. Hosted-dot pause, reset and approvals remain in the [original platform controls](https://learn.chatgpt.com/docs/dots/controls). Status reports `hosted_dot_controls: false`; no undocumented control endpoint is called.

## Upgrades and recovery

Keep the original keys, bindings, subscriptions, queues, deduplication and uncertain outcomes. Use a consistent SQLite backup and the retained previous release. Drain progressive native replies before downgrading code that cannot understand their references. Never replace current state with an older pre-message database. A same-host lock does not fence a second machine.

Records are logically cleared after seven days. SQLite pages, WAL, backups and host journals have their own retention; logical clearing is not physical erasure. Application logs use fixed startup/status information and suppress raw provider messages, identities, credentials and complete callback URLs.


### Delivery state and routed diagnostics

For shared Weixin/Telegram/Discord adapters, `get_<channel>_reply_status` reports final delivery. Reading/beginning processing changes the feedback lease; before a final answer is queued its delivery state remains `none`. `pending` means queued, `processing` a final write, and `sent` platform acknowledgement. The current begin/append flow still completes one final answer. Lark keeps delta appends; QQ/Telegram/Discord submit cumulative generated text.

Behind the aggregate Tunnel use `check_<channel>_readiness`; direct backends expose `check_<channel>_setup`. QQ retains `check_bridge_setup` and Lark `check_lark_readiness`. CLI status handles that mapping.

The table lists component built-in ports. A multi-channel installation may explicitly use 8801–8806 for DingTalk, WeCom, Weixin, Discord, Telegram and LINE, keeping existing Tunnel-admin ports free. Choose available ports in actual configuration.

Policy defaults are feedback off, maintenance on for these three adapters, a 60-second typing lease (10–300), history of 20 messages (1–50) and 12000 characters (1000–20000), and empty groups. Weixin uses typing; set reaction/streaming false and keep groups empty. Durable `chunks` applies to Telegram/Discord; Weixin, DingTalk and WeCom retain complete-file delivery.
