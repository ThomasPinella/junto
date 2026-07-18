# 3. Authentication and membership

## 3.1 Account creation

A person may create or activate an account only when their normalized email address matches an active invitation or allowlist entry.

Email matching should:

- ignore capitalization;
- trim whitespace;
- use the verified email associated with the authenticated account;
- prevent an invitation from being claimed by a different verified email.

Example:

Thomas@Example.com
thomas@example.com
 THOMAS@example.com

These should be treated as the same address.

## 3.2 Invitation lifecycle

An administrator adds an email address to a Junto.

That creates a pending invitation.

When the invited user authenticates with the matching email:

1. the invitation is claimed;
2. a junto_members record is created or activated;
3. the invitation records when and by whom it was claimed;
4. the user gains access to that Junto.

The invitation should remain as historical evidence rather than serving as the permanent authorization source.

The durable authorization source is the active junto_members record.

## 3.3 Multiple memberships

A user may belong to multiple Juntos.

The portal should allow the user to switch between Juntos when they have more than one active membership.

All group-scoped queries and permissions must use the currently selected junto_id.

## 3.4 Membership removal

When a membership is deactivated:

- the user immediately loses access to members-only essays in that Junto;
- the user immediately loses access to that Junto’s chat;
- the user can no longer comment within that Junto;
- their previously published public essays remain public unless changed by the author or an administrator;
- their historical authorship and comments remain attributed to them;
- their account may remain active if they belong to another Junto.
