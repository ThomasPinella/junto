# 13. Authorization model

Row Level Security should be treated as a core requirement, not optional hardening.

## Public access

Unauthenticated users may read:

- active public Juntos;
- published public essays;
- the narrow author identity fields included in the eligible-public-essay
  projection, such as author display name and slug;
- public meeting metadata;
- publicly readable comments attached to public essays.

Unauthenticated users may not read the profiles base table. Public author
identity must be derived only from eligible published public essays, so a
profile without an eligible public essay has no anonymous read path.

Unauthenticated users may not write any records.

## Member access

An authenticated user may read Junto-scoped private data only when an active membership exists:

junto_members.user_id = auth.uid()
junto_members.junto_id = row.junto_id
junto_members.status = active

## Essay ownership

A member may create an essay only for themselves.

A member may update only their own essay content. Only the author may edit an
essay body; administrative authority never permits rewriting the author's
words.

There is no essay delete path for members or administrators in this MVP
slice. Unpublishing is the bounded revocation path and preserves the essay
record.

The application must prevent a member from changing:

- author_id to another user;
- junto_id to an unauthorized Junto;
- meeting_id to a meeting in another Junto.

## Comments

A member may comment only when:

- they have an active membership in the essay’s Junto;
- they can read the essay;
- the essay is in a commentable state.

## Chat

A member may read and create chat messages only within a Junto where they have active membership.

A user must not receive unauthorized messages through either normal queries or realtime subscriptions.

## Admin permissions

Admin rights should be scoped through:

junto_members.role = admin

Within the administrator's own Junto, essay moderation is limited to bounded
metadata and publication controls, including visibility and publication
state. Administrators may not rewrite essay bodies and may not delete essays
in this MVP slice.

Never use a global application-wide admin assumption for ordinary Junto management.
