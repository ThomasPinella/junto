# Implementation Plan and Testing

Build in vertical batches that prove authorization and cross-Junto isolation early, then verify the complete product through critical user journeys.

## 16. Recommended implementation batches

### Batch 1 — Foundation and membership

- initialize application;
- create Junto, profile, invitation, and membership tables;
- implement authentication;
- implement email allowlisting;
- create member portal shell;
- write RLS and pgTAP tests;
- prove isolation between two Juntos.

### Batch 2 — Meetings

- create meeting schema;
- implement admin meeting management;
- create public and member meeting pages;
- test meeting access and group isolation.

### Batch 3 — Essays

- create essay schema;
- implement Markdown editor and preview;
- implement drafts and publication;
- associate essays with meetings;
- implement public and members-only visibility;
- create public essay, author, and archive pages;
- test visibility transitions and metadata leakage.

### Batch 4 — Comments

- create comment schema;
- implement top-level comments and replies;
- implement author editing and deletion;
- implement moderation;
- verify that comment access always follows essay access.

### Batch 5 — Chat

- create chat schema;
- implement one Junto chat;
- add realtime updates;
- add pagination;
- test cross-Junto isolation;
- test deactivated-member access;
- review realtime authorization.

### Batch 6 — Editorial polish and video embeds

- refine typography and public reading pages;
- add meeting-level YouTube embed;
- add related essays by meeting and author;
- improve empty states, loading states, and responsive behavior;
- run complete Playwright journeys.

## 17. Critical end-to-end journeys

### Invited member activation

Admin allowlists email
→ user authenticates with matching email
→ membership is created
→ user enters the correct Junto portal

### Rejected registration

Uninvited user authenticates
→ no membership is created
→ user cannot access a Junto portal

### Public essay publication

Member creates draft
→ selects meeting
→ chooses Public
→ previews Markdown
→ publishes
→ essay appears in public archive and meeting page

### Members-only publication

Member creates essay
→ chooses Junto members only
→ publishes
→ active member can read it
→ visitor cannot access it
→ member of another Junto cannot access it

### Visibility revocation

Author changes public essay to members only
→ public page stops serving content
→ public archive removes essay
→ same-Junto member still has access

### Essay discussion

Member reads accessible essay
→ posts comment
→ another member replies
→ visitor can read discussion only when policy permits
→ outsider cannot participate

### Junto chat isolation

Member sends message in Junto A
→ another Junto A member receives it in realtime
→ Junto B member never receives or queries it

### Membership deactivation

Admin deactivates member
→ member loses private essay access
→ member loses chat access
→ public essays remain available
