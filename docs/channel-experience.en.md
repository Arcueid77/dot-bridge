# Using DotBridge in chat

[简体中文](channel-experience.md) · [Home](../README.en.md)

## Buttons and choice menus

Ask your original dot to offer a PDF or Markdown choice. Feishu, Telegram and Discord support native buttons or a single-choice menu. Choices last up to ten minutes and bind to the requesting person, conversation and topic. Repeating the same click reuses its first outcome.

A choice becomes one new input for the original dot. Reminder buttons can pause, resume or cancel the reminder and revision they reference. Other channels show numbered choices that you can answer in text.

Telegram installs a command menu only in the paired owner's private chat. For Feishu, the application administrator needs to review the callback configuration and enable `card.action.trigger` using the existing long connection. See the [official callback guide](https://open.feishu.cn/document/event-subscription-guide/callback-subscription/receive-and-handle-callbacks).

## Long answers

Ask for a Markdown file to select file delivery for an individual answer. Telegram, Discord and LINE also offer explicit text chunks. Automatic mode follows the channel preference.

Chunking preserves paragraphs, code blocks and tables where they fit. Large tables repeat their headers. Progressive replies coalesce frequent small updates before submitting the final answer. On QQ, choose file delivery before starting a stream.

## Albums and generated files

Telegram combines an album into one input and retains its captions. Received attachments can be returned by their original attachment index.

Your original dot can upload a generated report or image and send it to the original conversation. Its tool environment must be able to read that generated file programmatically and call the upload tools. Chunks are checked for size and SHA-256 before a separate final-send operation. Original files are limited to 5 MiB and provider format rules still apply.

## Reminders

Reminders support once, daily, weekly, Monday through Friday, and fixed intervals of at least five minutes. Recurring reminders require an end date.

The management page has a reminders view for creation, editing, pause, resume, cancellation and the last twenty delivery attempts. A reminder can be saved paused for review. Delivery uses the selected channel's already paired owner private chat and requires that channel's proactive-send setting.

Resuming recurring work skips old paused occurrences. Edit a missed one-time reminder to a future time before resuming. Unknown delivery outcomes stay available for owner reconciliation. See [scheduled messages](scheduled-messages.en.md) and [management access](management.en.md).
