# 9. Member chat

Each Junto has a simple private group chat.

The chat is intentionally lightweight. It is not intended to replace Slack, Discord, or a full messaging platform.

## 9.1 Access

Only authenticated users with an active membership in the relevant Junto may:

- view messages;
- send messages;
- subscribe to realtime updates.

Chat messages must never be publicly accessible.

## 9.2 Chat behavior

The initial chat should support:

- one shared channel per Junto;
- chronological messages;
- sender name and avatar;
- message timestamp;
- text messages;
- automatic realtime updates;
- basic Markdown or plain text;
- edit own recent message;
- delete own message;
- admin moderation;
- loading older messages.

The MVP does not need:

- direct messages;
- multiple channels;
- voice messages;
- file uploads;
- reactions;
- typing indicators;
- read receipts;
- mentions;
- push notifications;
- complex presence.

## 9.3 Message model

Each message includes:

- ID;
- junto_id;
- sender ID;
- body;
- creation timestamp;
- update timestamp;
- deletion or moderation state.

The server or database must derive authorization from the authenticated membership rather than trusting a user-provided group identifier.

## 9.4 Realtime behavior

Supabase Realtime can deliver new messages to connected members.

Realtime subscriptions do not replace authorization.

The underlying database query and realtime channel must both prevent a user from receiving messages from a Junto to which they do not belong.

## 9.5 Chat retention

For the MVP, chat messages may be retained indefinitely.

Pagination should prevent the application from loading the entire history at once.

A reasonable initial page size is approximately 30–50 messages.
