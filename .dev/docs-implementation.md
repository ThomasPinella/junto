# Documentation implementation alignment

Current reviewed product commit: `8149895f66c532a6165ef7719e811b751ac7bf82` (`dev/core-product`).

## `AGENTS.md`

### Implemented

Repository architecture, security, privacy, code-quality, accessibility, testing, and local-development rules govern the Next.js/Supabase implementation and its verification harnesses.

### Not implemented

Deployment remains an explicit human-authorized operation rather than product code. That authorization was subsequently granted: the reviewed release is live on Railway, the hosted Supabase project is migrated and configured, and the controlled initial Junto/admin invitation bootstrap is complete.

### Residual risks

Hosted configuration and behavior remain unverified until separately approved deployment work.

## `DESIGN.md`

### Implemented

Warm-paper canvas, contemporary civic-journal typography, masthead, editorial hierarchy, reading measure, understated controls, public/private distinction, responsive behavior, and visible focus are implemented across the public archive and member portal.

### Not implemented

Dark mode, final photography, future motifs, and exhaustive visual polish.

## `docs/README.md`

### Implemented

The documented product center—Juntos, invitations/memberships, meetings, essays, and the public archive—is realized as one coherent core loop.

### Not implemented

Feature areas explicitly deferred below remain documentation-only.

## `docs/design/README.md`

### Implemented

The selected contemporary civic-journal direction and meeting-led public composition are implemented.

### Not implemented

Alternative concepts and secondary visual explorations not needed by the accepted surfaces.

## `docs/design/surface-guidelines.md`

### Implemented

Public homepage/archive/essay/meeting/author surfaces and portal/sign-in/meeting/essay-editor surfaces follow the relevant responsive, typography, focus, motion, and public/private guidance. Required mobile targets are backed by rendered bounds under a mobile browser profile.

### Not implemented

Discussion, chat, recordings, final imagery program, and deferred-feature surfaces.

## `docs/overview/vision-and-practice.md`

### Implemented

The product presents a public civic archive around recurring Junto meetings and member essays while preserving private chapter participation and a multiple-Junto foundation.

### Not implemented

Cross-chapter gatherings and longer-term network behavior.

## `docs/overview/product-principles.md`

### Implemented

Essays remain the primary public artifact; meetings provide civic context; private material is isolated; public output is editorial rather than social-feed-like; multi-Junto scope is explicit.

## `docs/membership/user-roles.md`

### Implemented

Visitor, active member, and Junto-scoped admin permissions are enforced for portal access, profiles, meetings, essays, invitations, membership administration, and public views.

### Not implemented

Comment moderation, chat moderation, and permissions for deferred features.

## `docs/membership/authentication-and-membership.md`

### Implemented

Invitation admission occurs before Auth user creation; normalized invited identities verify through genuine email/OTP or confirmed password flows; explicit claiming creates profile/membership state; active memberships independently authorize each Junto; switching and immediate deactivation are enforced.

### Not implemented

General notification delivery and broad invitation-management workflows beyond the accepted admin flow.

### Residual risks

Hosted before-user-created hook, confirmation, SMTP, and redirect configuration require explicit bootstrap verification.

## `docs/membership/juntos.md`

### Implemented

Multiple Juntos, stable slugs, active/inactive state, public/private publication state, Junto-scoped membership/role handling, and canonical portal/public routing are implemented. `/` serves the configured initial public Junto without constraining the data model to one chapter.

### Not implemented

Public self-service Junto creation, automatic production bootstrap, and bespoke per-Junto visual identities.

## `docs/content/meetings.md`

### Implemented

Upcoming, completed, cancelled, and archived meetings; Junto-scoped admin create/edit/archive; authorized member program/detail; safe public projection; stable public proceedings route; cross-Junto integrity; no hard deletion.

### Not implemented

Recordings and complex event scheduling.

## `docs/content/essays.md`

### Implemented

Meeting-linked canonical Markdown; sanitized rendering; author-only body/draft access; draft/published status; public/members-only visibility; stable global slugs; safe preview; create/save/reload/edit/publish/unpublish/visibility transitions; deliberate literal-TRUE public confirmation; public revocation.

### Not implemented

Cover images, version history, collaborative editing, native uploads, standalone-essay product flows, and nonessential code-block expansion.

### Residual risks

Any future public projection column needs privacy review; public lists currently use bounded reads.

## `docs/experience/public-archive.md`

### Implemented

Configured-Junto meeting-led homepage, public essay archive, canonical reading pages, public author pages, meeting proceedings, author/meeting filters, safe metadata, and sitemap. Only eligible public projection data is exposed; revocation is effective on the next request.

### Not implemented

Public discussion, topic/tag browsing, search, recommendations, and archive/sitemap pagination beyond 100 records.

### Residual risks

Add pagination and full sitemap scaling before public records materially exceed the current cap.

## `docs/experience/member-portal.md`

### Implemented

Invitation-gated sign-in, role-aware portal shell, membership switching, next-meeting/program context, meeting administration, membership/profile basics, essay dashboard/editor/preview, publishing, safe session redirects, and immediate deactivation denial.

### Not implemented

Recent comments, chat activity/chat, and full member-directory polish.

## `docs/architecture/data-model.md`

### Implemented

Versioned profiles, Juntos, invitations, memberships, meetings, and essays with Junto IDs, integrity constraints, timestamps, meeting archival, and essay `draft | published` status separated from visibility.

### Not implemented

Comments, chat messages, meeting videos, and data models for deferred features.

## `docs/architecture/authorization.md`

### Implemented

`junto_members` is the durable authorization source; membership checks are live, Junto-scoped, and deactivation-aware. Invitations do not confer durable authority. Authors alone edit essay bodies; same-Junto admins have bounded metadata/publication moderation. Public identity/content comes only from safe public projections; anonymous users have no base-profile access. Cross-Junto/private denials fail closed.

### Not implemented

Comment and realtime-chat authorization policies.

### Residual risks

Owner-rights public views are narrow deliberate RLS exceptions; future projection changes require explicit privacy review and strict tests.

## `docs/planning/product-decisions.md`

### Implemented

Separate essay publication/visibility, author-only drafts/bodies, bounded admin moderation, meeting archival, removed-member behavior, Markdown canon, stable slugs, multi-membership, canonical chapter routes, and invitation-gated access are reflected in code and tests.

### Not implemented

Decisions tied only to public comments and chat.

## `docs/planning/mvp-scope.md`

### Implemented

Public archive, invitation-gated authentication, memberships/roles, meetings, essay authoring/publication, and required admin tools are complete.

### Not implemented

Comments/replies, chat/realtime, recordings, notifications, search, tags, recommendations, version history, collaborative editing, uploads, payments, native apps, self-service Junto creation, and production deployment/bootstrap.

## `docs/planning/success-criteria.md`

### Implemented

Invitation admission/claiming, Junto access, meeting-linked essay authoring, public and members-only publication, visibility revocation, cross-Junto isolation, deactivation, public projection safety, and clean-reset integrated journey criteria are backed by database, harness, and browser evidence.

### Not implemented

Success criteria for comments and realtime chat.

## `docs/implementation/implementation-batches.md`

### Implemented

Batches 1–3 are implemented as the integrated core-product run, with authorization and isolation proven across schema, server, public projection, and browser boundaries. Foundational styling and release verification needed by those batches are also complete.

### Not implemented

Batches 4–6 beyond that accepted foundation.

## `docs/implementation/critical-journeys.md`

### Implemented

Invited activation, rejected registration, multi-Junto access, public publication, members-only publication, visibility revocation, membership deactivation, meeting administration, essay workspace, and anonymous archive reading are covered, including a complete genuine integrated core loop.

### Not implemented

Essay discussion and Junto chat journeys.

## Repository-wide operational status

- The reviewed release is deployed at `https://web-production-7724e.up.railway.app`; exact handles and hosted evidence are recorded in `.dev/runs/core-product/deployment.md`.
- Hosted Supabase migrations, Auth hook, required confirmations, exact redirects, Resend SMTP, Railway variables, controlled bootstrap, anonymous reads, invitation rejection, and pre-confirmation privacy were verified.
- The operator's delivered email link remains the intentional mailbox-owned first-login action; no privileged shortcut was used to claim the admin invitation.
- `/health` intentionally checks process/environment readiness only; separate hosted dependency checks passed and remain operationally distinct.
- No known discrepancy remains among the reviewed governing documents, implementation, tests, and deployed configuration.
