# 16. Recommended implementation batches

## Batch 1 — Foundation and membership

- initialize application;
- create Junto, profile, invitation, and membership tables;
- implement authentication;
- implement email allowlisting;
- create member portal shell;
- write RLS and pgTAP tests;
- prove isolation between two Juntos.

## Batch 2 — Meetings

- create meeting schema;
- implement admin meeting management;
- create public and member meeting pages;
- test meeting access and group isolation.

## Batch 3 — Essays

- create essay schema;
- implement Markdown editor and preview;
- implement drafts and publication;
- associate essays with meetings;
- implement public and members-only visibility;
- create public essay, author, and archive pages;
- test visibility transitions and metadata leakage.

## Batch 4 — Comments

- create comment schema;
- implement top-level comments and replies;
- implement author editing and deletion;
- implement moderation;
- verify that comment access always follows essay access.

## Batch 5 — Chat

- create chat schema;
- implement one Junto chat;
- add realtime updates;
- add pagination;
- test cross-Junto isolation;
- test deactivated-member access;
- review realtime authorization.

## Batch 6 — Editorial polish and video embeds

- refine typography and public reading pages;
- add meeting-level YouTube embed;
- add related essays by meeting and author;
- improve empty states, loading states, and responsive behavior;
- run complete Playwright journeys.
