# Data Model and Authorization

The application is multi-Junto from the beginning. Authorization and data isolation are core architecture, not optional hardening.

## 12. Suggested data model

### profiles

id
display_name
slug
bio
avatar_url
created_at
updated_at

The profile ID should correspond to the authenticated user ID.

### juntos

id
name
slug
description
location
archive_visibility
status
created_at
updated_at

### junto_invitations

id
junto_id
email_normalized
invited_by
role
status
expires_at
claimed_by
claimed_at
created_at

### junto_members

id
junto_id
user_id
role
status
joined_at
deactivated_at
created_at
updated_at

Recommended uniqueness:

unique (junto_id, user_id)

### meetings

id
junto_id
meeting_date
title
theme
description
location
essay_deadline
status
created_by
created_at
updated_at

### essays

id
junto_id
author_id
meeting_id
title
slug
subtitle
body_markdown
status
visibility
published_at
created_at
updated_at

Recommended values:

status:
- draft
- published
- archived
visibility:
- public
- members_only

### essay_comments

id
junto_id
essay_id
author_id
parent_comment_id
body_markdown
status
created_at
updated_at
deleted_at

Recommended values:

status:
- visible
- deleted_by_author
- removed_by_admin

### chat_messages

id
junto_id
author_id
body
status
created_at
updated_at
deleted_at

### meeting_videos

id
junto_id
meeting_id
youtube_video_id
title
description
added_by
created_at
updated_at

## 13. Authorization model

Row Level Security should be treated as a core requirement, not optional hardening.

### Public access

Unauthenticated users may read:

- active public Juntos;
- published public essays;
- profiles associated with public essays;
- public meeting metadata;
- publicly readable comments attached to public essays.

Unauthenticated users may not write any records.

### Member access

An authenticated user may read Junto-scoped private data only when an active membership exists:

junto_members.user_id = auth.uid()
junto_members.junto_id = row.junto_id
junto_members.status = active

### Essay ownership

A member may create an essay only for themselves.

A member may update or delete only their own essays unless they are an administrator.

The application must prevent a member from changing:

- author_id to another user;
- junto_id to an unauthorized Junto;
- meeting_id to a meeting in another Junto.

### Comments

A member may comment only when:

- they have an active membership in the essay’s Junto;
- they can read the essay;
- the essay is in a commentable state.

### Chat

A member may read and create chat messages only within a Junto where they have active membership.

A user must not receive unauthorized messages through either normal queries or realtime subscriptions.

### Admin permissions

Admin rights should be scoped through:

junto_members.role = admin

Never use a global application-wide admin assumption for ordinary Junto management.
