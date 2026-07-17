# Users, Membership, and Juntos

This document defines who can use Junto, how chapter access is granted, and how independent Juntos remain isolated.

## 2. User roles

### Visitor

A visitor is not logged in.

A visitor can:

- browse public Juntos, if the Junto itself is public;
- browse public essays;
- browse public author pages;
- browse public meeting pages;
- read public comments if public comments are enabled;
- follow public links to essays.

A visitor cannot:

- read members-only essays;
- access the member portal;
- view Junto chat;
- write comments;
- submit essays;
- view membership information.

### Member

A member is an authenticated user with an active membership in a specific Junto.

A member can:

- access the portal for that Junto;
- view public and members-only essays within that Junto;
- create and edit their own essays;
- assign essays to meetings;
- choose essay visibility;
- publish or unpublish their essays;
- comment on essays they are allowed to view;
- reply within essay discussion threads;
- read and send messages in that Junto’s member chat;
- view other active members of that Junto;
- manage their own profile.

Membership permissions apply separately for each Junto.

### Admin

An admin is a member with administrative permissions for a particular Junto.

An admin can:

- create and edit meetings;
- invite or allowlist members;
- deactivate memberships;
- view all essays within the Junto, including drafts if explicitly permitted;
- moderate comments;
- remove chat messages when necessary;
- manage basic Junto settings;
- assign or revoke administrative roles.

An admin in one Junto has no administrative rights in another Junto unless separately granted.

## 3. Authentication and membership

### 3.1 Account creation

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

### 3.2 Invitation lifecycle

An administrator adds an email address to a Junto.

That creates a pending invitation.

When the invited user authenticates with the matching email:

1. the invitation is claimed;
2. a junto_members record is created or activated;
3. the invitation records when and by whom it was claimed;
4. the user gains access to that Junto.

The invitation should remain as historical evidence rather than serving as the permanent authorization source.

The durable authorization source is the active junto_members record.

### 3.3 Multiple memberships

A user may belong to multiple Juntos.

The portal should allow the user to switch between Juntos when they have more than one active membership.

All group-scoped queries and permissions must use the currently selected junto_id.

### 3.4 Membership removal

When a membership is deactivated:

- the user immediately loses access to members-only essays in that Junto;
- the user immediately loses access to that Junto’s chat;
- the user can no longer comment within that Junto;
- their previously published public essays remain public unless changed by the author or an administrator;
- their historical authorship and comments remain attributed to them;
- their account may remain active if they belong to another Junto.

## 4. Juntos

Each Junto represents an independent essay and discussion group.

A Junto includes:

- name;
- slug;
- description;
- creation date;
- public or private archive setting;
- optional location;
- optional cover image or visual identity;
- active and inactive status.

Example URLs:

/juntos/san-diego
/juntos/san-francisco

The first Junto could simply use:

/juntos/san-diego

or potentially live at the root of the public site while the application still models it as a Junto internally.
