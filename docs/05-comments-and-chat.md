# Comments and Chat

Discussion stays attached to essays where possible; chapter chat remains deliberately lightweight.

## 8. Essay comments and discussion threads

Each essay should support discussion.

Comments are attached to a particular essay and may form simple threaded conversations.

### 8.1 Access rules

Only logged-in active members of the essay’s Junto may create comments.

A user may read comments only when they can read the parent essay.

Therefore:

- comments on members-only essays are visible only to members of that Junto;
- comments on drafts are visible only where the draft itself is visible;
- comments on public essays may either be public or members-only depending on the chosen product rule.

Recommended MVP rule

Comments on public essays should be publicly readable but writable only by logged-in Junto members.

This creates a rich public archive without opening the site to public spam or requiring external accounts.

The interface should state:

Discussion by Junto members

If you prefer all discussion to remain internal, public essays can instead hide comments from visitors. The schema should not make public visibility difficult to add later.

### 8.2 Threading

The MVP should support one level of replies:

Comment
└── Reply
└── Reply

Avoid deeply nested Reddit-style threads.

Each comment includes:

- junto_id;
- essay ID;
- author ID;
- optional parent comment ID;
- Markdown or plain-text body;
- creation timestamp;
- edit timestamp;
- deleted or moderated state.

### 8.3 Comment behavior

Members can:

- write a comment;
- reply to a top-level comment;
- edit their own comment;
- delete their own comment;
- view the author and timestamp.

Administrators can:

- hide or remove comments;
- restore comments if soft deletion is supported;
- view moderation metadata.

When a comment is deleted, replies should remain comprehensible. The interface can show:

This comment was deleted.

rather than deleting the entire thread.

### 8.4 Comment scope and security

Every comment must inherit its Junto from its essay.

A client must not be trusted to submit an arbitrary junto_id.

The database or server should verify:

comment.junto_id == essay.junto_id

Members of one Junto must not be able to comment on essays in another Junto.

## 9. Member chat

Each Junto has a simple private group chat.

The chat is intentionally lightweight. It is not intended to replace Slack, Discord, or a full messaging platform.

### 9.1 Access

Only authenticated users with an active membership in the relevant Junto may:

- view messages;
- send messages;
- subscribe to realtime updates.

Chat messages must never be publicly accessible.

### 9.2 Chat behavior

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

### 9.3 Message model

Each message includes:

- ID;
- junto_id;
- sender ID;
- body;
- creation timestamp;
- update timestamp;
- deletion or moderation state.

The server or database must derive authorization from the authenticated membership rather than trusting a user-provided group identifier.

### 9.4 Realtime behavior

Supabase Realtime can deliver new messages to connected members.

Realtime subscriptions do not replace authorization.

The underlying database query and realtime channel must both prevent a user from receiving messages from a Junto to which they do not belong.

### 9.5 Chat retention

For the MVP, chat messages may be retained indefinitely.

Pagination should prevent the application from loading the entire history at once.

A reasonable initial page size is approximately 30–50 messages.
