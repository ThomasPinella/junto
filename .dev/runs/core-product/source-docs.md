# core-product source document scope

This running list defines which parts of each source document this run intends to implement.

## `AGENTS.md`

- Implementing: Architecture, security, code, UI, testing, and workflow standards for the application foundation through the public archive.
- Not implementing: Operational actions that remain human approval boundaries, including deployment and production data changes.

## `DESIGN.md`

- Implementing: Core tokens, typography, masthead, editorial layout posture, controls, focus behavior, essay reading measure, and public/private visual distinction.
- Not implementing: Dark mode, future motifs, final photography, and exhaustive polish of surfaces outside this run.

## `docs/README.md`

- Implementing: The documentation map and product center as context for membership, meetings, essays, and the public archive.
- Not implementing: Feature areas explicitly deferred by this run.

## `docs/design/README.md`

- Implementing: The approved contemporary civic-journal direction and meeting-led public composition.
- Not implementing: Secondary concepts beyond what is needed for implemented surfaces.

## `docs/design/surface-guidelines.md`

- Implementing: Public homepage, archive, essay, meeting, author, portal, essay-dashboard, editor, responsive, accessibility, and motion guidance relevant to this run.
- Not implementing: Public discussion, chat, recordings, final imagery program, and surfaces for deferred features.

## `docs/overview/vision-and-practice.md`

- Implementing: The public/private product shape, chapter model, meeting-linked essay practice, and multiple-Junto foundation.
- Not implementing: Cross-chapter gatherings and other long-term network behavior.

## `docs/overview/product-principles.md`

- Implementing: Essay-centered hierarchy, editorial public experience, private-content protection, and multi-Junto isolation.
- Not implementing: None.

## `docs/membership/user-roles.md`

- Implementing: Visitor, member, and Junto-scoped admin permissions needed for membership, meetings, essays, profiles, and the portal.
- Not implementing: Comment moderation, chat moderation, and deferred feature permissions.

## `docs/membership/authentication-and-membership.md`

- Implementing: Verified normalized-email invitation claiming, durable memberships, multiple memberships, switching, and immediate deactivation effects relevant to this run.
- Not implementing: Notification delivery or a broad invitation-management product beyond the necessary admin flow.

## `docs/membership/juntos.md`

- Implementing: Multi-Junto entities, slugs, public/private archive state, status, location handling, and chapter-scoped routing.
- Not implementing: Public self-service chapter creation and bespoke per-chapter visual identities.

## `docs/content/meetings.md`

- Implementing: Meeting schema, admin creation/edit/archive, status, member views, safe public pages, and essay association.
- Not implementing: Recordings and complex event scheduling.

## `docs/content/essays.md`

- Implementing: Meeting-linked Markdown essays, drafts, publication, visibility, stable slugs, author ownership, safe rendering, editor/preview, and public/member access.
- Not implementing: Cover-image workflows, version history, standalone-essay product flows, and nonessential code-block support if it expands scope.

## `docs/experience/public-archive.md`

- Implementing: Meeting-led homepage, essay archive, reading pages, author pages, meeting pages, and browsing by author and meeting.
- Not implementing: Public discussion and later topic/tag browsing.

## `docs/experience/member-portal.md`

- Implementing: Portal shell, membership switching, next-meeting context, essay dashboard/editor, meeting views, profile basics, and role-aware admin entry points required by this run.
- Not implementing: Recent comments, recent chat activity, chat, and full member-directory polish.

## `docs/architecture/data-model.md`

- Implementing: Profiles, Juntos, invitations, memberships, meetings, and essays with integrity constraints and timestamps.
- Not implementing: Comments, chat messages, and meeting videos.

## `docs/architecture/authorization.md`

- Implementing: Public/member/admin access, active-membership checks, essay ownership, Junto isolation, and no unauthenticated writes for implemented tables.
- Not implementing: Comment and realtime-chat policies.

## `docs/planning/product-decisions.md`

- Implementing: Essay visibility, author-only drafts, ownership, meeting archival, removed-member behavior, Markdown canon, stable slugs, and multiple memberships.
- Not implementing: Public comment visibility and chat.

## `docs/planning/mvp-scope.md`

- Implementing: Public archive, invitation-gated authentication, memberships and roles, meetings, essay authoring/publication, and the subset of admin tools required for these areas.
- Not implementing: Comments, chat, recordings, and every explicitly excluded MVP feature.

## `docs/planning/success-criteria.md`

- Implementing: Success criteria for invitation, Junto access, essay authoring, meeting assignment, public publication, members-only isolation, cross-Junto isolation, and clean-reset checks.
- Not implementing: Comment and realtime-chat success criteria.

## `docs/implementation/implementation-batches.md`

- Implementing: Batches 1–3 as one integrated Dev run, with authorization and isolation proven early.
- Not implementing: Batches 4–6 except foundational styling and verification needed by implemented surfaces.

## `docs/implementation/critical-journeys.md`

- Implementing: Invited activation, rejected registration, public publication, members-only publication, visibility revocation, and relevant membership deactivation behavior.
- Not implementing: Essay discussion and Junto chat journeys.
