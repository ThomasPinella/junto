# 8. Essay comments and discussion threads

Each essay should support discussion.

Comments are attached to a particular essay and may form simple threaded conversations.

## 8.1 Access rules

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

## 8.2 Threading

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

## 8.3 Comment behavior

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

## 8.4 Comment scope and security

Every comment must inherit its Junto from its essay.

A client must not be trusted to submit an arbitrary junto_id.

The database or server should verify:

comment.junto_id == essay.junto_id

Members of one Junto must not be able to comment on essays in another Junto.
