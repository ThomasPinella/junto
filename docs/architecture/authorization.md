# 13. Authorization model

Row Level Security should be treated as a core requirement, not optional hardening.

## Public access

Unauthenticated users may read:

- active public Juntos;
- published public essays;
- profiles associated with public essays;
- public meeting metadata;
- publicly readable comments attached to public essays.

Unauthenticated users may not write any records.

## Member access

An authenticated user may read Junto-scoped private data only when an active membership exists:

junto_members.user_id = auth.uid()
junto_members.junto_id = row.junto_id
junto_members.status = active

## Essay ownership

A member may create an essay only for themselves.

A member may update or delete only their own essays unless they are an administrator.

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

Never use a global application-wide admin assumption for ordinary Junto management.
