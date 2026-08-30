# 12. Suggested data model

## profiles

id
display_name
slug
bio
avatar_url
created_at
updated_at

The profile ID should correspond to the authenticated user ID.

## juntos

id
name
slug
description
location
archive_visibility
status
created_at
updated_at

## junto_invitations

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

## junto_members

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

## Atomic Junto bootstrap

Junto creation reuses `juntos` and `junto_members`; it does not introduce a
global administrator or ownership table. One transactional database function
inserts an active Junto and creates or reactivates the authenticated creator's
administrator membership. If either write fails, neither record persists.

New Junto metadata is bounded at both the server and database boundaries:
names are 1–120 trimmed characters, slugs are 1–63 lowercase alphanumeric
segments separated by single hyphens, and the exact slug `sign-in` is reserved
for the static portal sign-in route. Descriptions are at most 2,000 characters,
and locations are at most 240 characters. Archive visibility is `private`
unless `public` is explicitly supplied.

## meetings

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

## essays

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
visibility:
- public
- members_only

## essay_comments

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

## chat_messages

id
junto_id
author_id
body
status
created_at
updated_at
deleted_at

## meeting_videos

id
junto_id
meeting_id
youtube_video_id
title
description
added_by
created_at
updated_at
