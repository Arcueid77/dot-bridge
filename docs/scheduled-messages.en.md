# Owner messages and saved reminders

The original dot can send or schedule literal text to an already paired owner
private chat. Once, daily and weekly reminders persist in the bridge's original
encrypted database and survive restarts. Generated content needs an actual task
saved on the original dot, which later calls the target channel's send tool.

Lark, QQ, Weixin iLink, Telegram, Discord, DingTalk, WeCom and LINE have implementation support.
Weixin independent sends use the existing login without an inbound context token;
verify acceptance with the paired owner account before relying on reminders. Enable
only an authorized channel by setting `DOT_BRIDGE_OUTBOUND=owner-text` in its
protected backend environment, restarting it and the router, and refreshing the
original plugin's tools. The default is `disabled`; inbound subscriptions stay
unchanged. No extra Token, public MCP port or callback allowance is required.

## QQ platform availability

Tencent's [official SDK](https://github.com/tencent-connect/qqbot-nodejs/blob/main/USAGE.md)
contains proactive C2C examples, while the [platform documentation](https://github.com/tencent-connect/bot-docs/blob/main/docs/develop/api-v2/server-inter/message/send-receive/send.md)
retains a suspension notice effective 2025-04-21. Verify the current application's
eligibility and quota before enabling QQ. Local implementation support and opt-in
report only those observations. This change has not verified a real app's access.

QQ sends to the owner from its protected credentials, with no old message ID,
event ID, passive sequence or caller-supplied recipient. Delivery does not depend
on the incoming gateway or event subscription. Ordinary incoming messages still
use the original dot event subscription.

## Weixin platform acceptance

Weixin independent requests omit `context_token` and never read a cached inbound
token. The [Tencent protocol reference](https://github.com/Tencent/openclaw-weixin/blob/main/docs/protocol.md)
describes this client behavior; account acceptance must be verified using an actual
request. An explicit nonzero business response, permission denial, or quota response
persists as `rejected` and pauses the reminder. A missing ACK, server error, or lost
connection remains `uncertain`. Neither outcome is automatically retried.

## Tools and saved intent

For a supported channel, use `check_<channel>_outbound`,
`send_<channel>_message`, `schedule_<channel>_message`,
`list_<channel>_scheduled_messages`, `get_<channel>_outbound`,
`update_<channel>_scheduled_message`, and `cancel_<channel>_scheduled_message`.

Each message is at most 2000 characters. Saved reminders require an explicit UTC
offset and IANA timezone. Recurring reminders require an end time within one year.
Report a reminder as saved only after receiving its actual outbound ID. Updates
and cancellation use that ID and current revision. Reuse the same idempotency key
for retries of the same intent. Missing reminders more than five minutes late are
skipped after downtime, avoiding a burst of stale sends.

`pending`/`active` means saved work. `sent` means provider acknowledgement, not
recipient reading. QQ and Weixin explicit business/permission/quota rejection becomes `rejected` with
`provider_permission_denied`, `provider_quota_exhausted`, or `provider_rejected`.
Recurring work pauses. Timeouts, malformed/lost ACKs and 5xx remain `uncertain`.
Neither state retries automatically; inspect the saved ID and actual platform/chat
before further action. Cancellation preserves the last rejection/uncertainty.

Turning outbound off holds future work and preserves passive replies. Keep the
original database/storage key, inspect saved work before upgrade or rollback, and
keep backend, router and core versions compatible. Terminal text is logically
removed after seven days; active reminders and minimal deduplication remain under
their original limits. This does not physically erase SQLite pages, WAL or backups.
