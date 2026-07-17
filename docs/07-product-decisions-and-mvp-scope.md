# Product Decisions and MVP Scope

This document records recommended product rules, the MVP boundary, and the conditions for calling the MVP successful.

## 14. Important product decisions to document

These decisions should become explicit requirements before implementation.

### Recommended decisions

### Essay visibility

Use:

Public
Junto members only

### Public comment visibility

Public essays may show comments publicly, but only Junto members may comment.

### Draft visibility

Drafts are visible only to the author and authorized admins.

### Essay ownership

Members may edit only their own essays.

Admins may moderate metadata and visibility but should avoid rewriting essay content unless an explicit policy allows it.

### Meeting deletion

Meetings are archived rather than hard-deleted.

### Removed members

Removing a member revokes private access immediately but does not erase their historical public content.

### Chat

One shared private chat per Junto.

### Markdown

Essays use Markdown as the canonical stored format.

### Slugs

Essay slugs remain stable after publication.

### Multiple Juntos

Users can belong to more than one Junto and switch between them.

## 15. MVP scope

### Included

### Public experience

- public homepage;
- public essay archive;
- public essay reading pages;
- author pages;
- meeting pages;
- browse by author;
- browse by meeting.

### Authentication and membership

- authentication;
- email allowlisting or invitation;
- account activation;
- multiple Junto memberships;
- member and admin roles.

### Essays

- Markdown editor;
- Markdown preview;
- create draft;
- edit own essay;
- choose meeting;
- choose visibility;
- publish;
- unpublish;
- stable public URL.

### Comments

- top-level comments;
- one level of replies;
- edit own comment;
- delete own comment;
- admin moderation;
- comments restricted by essay access.

### Chat

- one private chat per Junto;
- realtime messages;
- pagination;
- edit or delete own messages;
- admin moderation.

### Admin

- create and edit meetings;
- invite or allowlist members;
- deactivate memberships;
- manage roles;
- moderate comments and chat;
- add unlisted YouTube recording to a meeting.

### Explicitly excluded from MVP

- likes;
- follower counts;
- public account registration;
- public commenting;
- direct messages;
- multiple chat channels;
- reactions;
- push notifications;
- email notifications;
- AI essay feedback;
- semantic search;
- essay version history;
- collaborative editing;
- native video uploads;
- mobile applications;
- complex event scheduling;
- payment processing;
- invitations between ordinary members;
- tags and recommendation algorithms.

## 20. MVP success criteria

The MVP is successful when:

1. an administrator can create a Junto and invite approved members;
2. an invited member can authenticate and access only their Juntos;
3. a member can write, preview, save, and publish a Markdown essay;
4. an essay can be assigned to a specific meeting;
5. a public essay appears in a polished public archive;
6. a members-only essay is accessible only to active members of its Junto;
7. members can discuss accessible essays through comments and replies;
8. members can exchange realtime messages in their private Junto chat;
9. users from different Juntos cannot access one another’s private data;
10. migrations, database tests, integration tests, and critical Playwright journeys pass from a clean local reset.
