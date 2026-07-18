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
- archived
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
