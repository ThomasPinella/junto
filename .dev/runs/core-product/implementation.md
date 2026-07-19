# core-product implementation

## Goal

Build Junto's first coherent core-product slice from the documentation-only repository: a production-shaped Next.js and Supabase application in which invited members can securely enter one or more Juntos, administrators can manage meetings, members can write and publish meeting-linked Markdown essays, and visitors can browse a polished public archive containing only explicitly public material.

The run should prove the product's central loop and its hardest invariant: private data remains isolated across users and Juntos at the database, server, page, metadata, and cache boundaries.

## Sources

- `AGENTS.md`
- `DESIGN.md`
- `docs/README.md`
- `docs/design/README.md`
- `docs/design/surface-guidelines.md`
- `docs/overview/vision-and-practice.md`
- `docs/overview/product-principles.md`
- `docs/membership/user-roles.md`
- `docs/membership/authentication-and-membership.md`
- `docs/membership/juntos.md`
- `docs/content/meetings.md`
- `docs/content/essays.md`
- `docs/experience/public-archive.md`
- `docs/experience/member-portal.md`
- `docs/architecture/data-model.md`
- `docs/architecture/authorization.md`
- `docs/planning/product-decisions.md`
- `docs/planning/mvp-scope.md`
- `docs/planning/success-criteria.md`
- `docs/implementation/implementation-batches.md`
- `docs/implementation/critical-journeys.md`

## Decisions and boundaries

- Build with the Next.js App Router and strict TypeScript, hosted statelessly and prepared for Railway deployment.
- Use Supabase for Postgres, authentication, Row Level Security, and local development. All schema and policy changes live in versioned migrations.
- Use `pnpm` as the sole package manager unless changed before approval.
- Use Supabase email magic-link or email-OTP authentication. Product behavior remains invitation-gated: an uninvited verified email must not acquire a profile, membership, portal access, or private data access. Use the strongest cleanly supported Supabase mechanism rather than relaxing this product rule for implementation convenience.
- Treat active `junto_members` records—not invitations or UI state—as the durable authorization source.
- Use canonical chapter pages under `/juntos/[juntoSlug]` and globally stable essay pages under `/essays/[essaySlug]`. `/` serves the explicitly configured initial chapter’s publication homepage without hard-coding the data model to one Junto.
- Bootstrap development with deterministic fixtures for at least two Juntos, invited users, members, administrators, meetings, and essays. Do not build a general public Junto-creation flow in this run.
- Model all group-scoped data with `junto_id`; derive identity and scope on the server or in the database rather than trusting client-submitted ownership or authorization fields.
- Store Markdown canonically, render it through a sanitized pipeline, and keep rendered previews visually consistent with public essays.
- Keep publication status separate from visibility. Drafts are author-only; published essays may be `public` or `members_only`.
- Use globally unique, stable essay slugs because public essay URLs are `/essays/[slug]`. Title changes do not alter an established slug.
- Never expose members-only essays, draft details, private counts, meeting locations, invitation data, or membership data through public routes, metadata, sitemaps, previews, errors, logs, or caches.
- Public comments, member chat, realtime behavior, notifications, recordings, tags, search, likes, reactions, direct messages, payments, and native applications are outside this run.
- Establish the approved contemporary civic-journal visual system on implemented surfaces. Do not turn the run into an exhaustive polish pass or invent generic SaaS UI.
- Deployment, production credentials, production data changes, and production bootstrap remain explicit human approval boundaries.

## Tasks

## T01 — Establish the application and verification foundation

- Sources: `AGENTS.md`, `DESIGN.md`, `docs/design/README.md`, `docs/design/surface-guidelines.md`, `docs/overview/product-principles.md`
- Depends on: none
- Outcome: A strict TypeScript Next.js application uses one package manager, has Supabase local-development configuration, environment validation, the approved typography and design tokens, initial public/member route shells, and standard scripts for formatting, linting, typechecking, unit tests, database tests, Playwright tests, and production builds.
- Proof: Fresh install succeeds; environment failures are explicit; formatter, lint, typecheck, focused tests, and production build pass; route shells render responsively with keyboard-visible focus and no generic card-dashboard styling.
- Status: complete; C01 reconciled cleanly with non-blocking notes by R02 (R01 infrastructure-blocked)

## T02 — Implement identity, invitations, memberships, and authorization

- Sources: `docs/membership/user-roles.md`, `docs/membership/authentication-and-membership.md`, `docs/membership/juntos.md`, `docs/architecture/data-model.md`, `docs/architecture/authorization.md`, `docs/planning/product-decisions.md`, `docs/implementation/critical-journeys.md`
- Depends on: T01
- Outcome: Versioned migrations define profiles, Juntos, invitations, and memberships; normalized invitations can be claimed only by the matching verified identity; active memberships govern access independently per Junto; deactivation revokes access immediately; admin authority remains Junto-scoped.
- Proof: Database tests cover normalized-email matching, successful and rejected claims, duplicate claims, multiple memberships, member/admin boundaries, deactivation, unauthenticated denial, and denied cross-user/cross-Junto access using fixtures for at least two Juntos.
- Status: complete; cumulative T02 integrated at `2608ba655a20a9b648dfcebd1ff96cb3d27311c6` after clean R07 reconciliation. Strict invitation gating, real mailbox verification, durable independently Junto-scoped membership authorization, denied-path coverage, and the fail-closed local Auth harness are verified.

## T03 — Deliver the invitation-gated member entry and portal shell

- Sources: `docs/membership/authentication-and-membership.md`, `docs/membership/user-roles.md`, `docs/experience/member-portal.md`, `docs/design/surface-guidelines.md`, `docs/implementation/critical-journeys.md`
- Depends on: T02
- Outcome: An invited person can authenticate, claim the matching invitation, enter the correct Junto portal, switch between active memberships, and see role-appropriate navigation; an uninvited or deactivated person receives a safe rejection and no private data.
- Proof: Integration and Playwright coverage demonstrate invited activation, rejected registration, multi-Junto switching, Junto-scoped admin navigation, session handling, and immediate access loss after membership deactivation.
- Status: complete; cumulative T03 integrated at `a26c85ff5c6c766498ddebf2b05affff2c329f95` after R09 returned clean with non-blocking notes. Real invitation-gated mailbox authentication, verified-session claiming, live multi-Junto authorization/deactivation, scoped admin navigation, safe redirects/sessions, private rendering, and fail-closed live journey fixtures are verified.

## T04 — Implement meetings as a complete vertical slice

- Sources: `docs/content/meetings.md`, `docs/membership/user-roles.md`, `docs/experience/member-portal.md`, `docs/experience/public-archive.md`, `docs/architecture/data-model.md`, `docs/architecture/authorization.md`, `docs/design/surface-guidelines.md`
- Depends on: T03
- Outcome: Versioned schema and policies support upcoming, completed, cancelled, and archived meetings; Junto admins can create, edit, and archive meetings; members can view authorized meeting details; visitors can view safe public meeting pages without private essay counts or sensitive location data.
- Proof: Database and integration tests cover admin/member/visitor behavior, meeting-to-Junto integrity, archive semantics, denied cross-Junto writes and reads, and public-page non-disclosure; Playwright exercises admin creation/edit/archive and public/member meeting views.
- Status: complete; cumulative T04 integrated at `c389f34b6bcbfa7e891c6e78674f565a89e82a52` after R10 returned clean with non-blocking notes. Meeting schema/RLS, selected-Junto admin actions, member program/detail, safe owner-rights public projection, public archive/detail, no-delete archive semantics, and bounded outage rendering are verified.

## T05 — Implement secure essay storage, rendering, and publication rules

- Sources: `docs/content/essays.md`, `docs/architecture/data-model.md`, `docs/architecture/authorization.md`, `docs/planning/product-decisions.md`, `docs/overview/product-principles.md`, `docs/implementation/critical-journeys.md`
- Depends on: T04
- Outcome: Versioned schema and policies support meeting-linked essays, author ownership, draft/published status, public/members-only visibility, stable global slugs, publication timestamps, and safe Markdown rendering while enforcing same-Junto meeting assignment and author-only draft access.
- Proof: Database and integration tests cover ownership, cross-Junto meeting rejection, draft isolation, same-Junto members-only access, public access, slug stability and uniqueness, unsafe Markdown sanitization, unpublishing, and both directions of visibility transition without metadata leakage.
- Status: ready; T04 is integrated and R10 explicitly unblocked this assignment.

## T06 — Deliver the member essay workspace and publishing journey

- Sources: `docs/content/essays.md`, `docs/experience/member-portal.md`, `docs/design/surface-guidelines.md`, `docs/planning/mvp-scope.md`, `docs/implementation/critical-journeys.md`
- Depends on: T05
- Outcome: Members can list their drafts and published work, create or paste an essay, select a meeting, edit Markdown, preview the actual reading typography, save a draft, publish, unpublish, and deliberately change visibility; members cannot edit another author's work.
- Proof: Component/integration tests cover editor validation and state transitions; Playwright demonstrates draft creation, save/reload, preview, public publication, members-only publication, unpublishing, and explicit confirmation before exposing a members-only essay publicly.
- Status: blocked

## T07 — Deliver the public civic-journal archive

- Sources: `DESIGN.md`, `docs/design/surface-guidelines.md`, `docs/overview/vision-and-practice.md`, `docs/overview/product-principles.md`, `docs/experience/public-archive.md`, `docs/content/meetings.md`, `docs/content/essays.md`
- Depends on: T06
- Outcome: Visitors can use a meeting-led public homepage, essay archive, essay reading pages, author pages, and meeting pages; browsing by author and meeting works; implemented surfaces follow the approved editorial hierarchy and reveal only published public content.
- Proof: Integration tests verify public queries and metadata include only eligible records; Playwright covers homepage-to-essay, archive-by-author, archive-by-meeting, author, and meeting journeys on desktop and mobile; accessibility checks and visual review confirm readable long-form typography and keyboard operation.
- Status: blocked

## T08 — Prove the integrated core-product journeys and deployment readiness

- Sources: `docs/planning/mvp-scope.md`, `docs/planning/success-criteria.md`, `docs/implementation/critical-journeys.md`, `AGENTS.md`
- Depends on: T02, T03, T04, T05, T06, T07
- Outcome: The repository can be reset locally and exercise the complete invitation → membership → meeting → writing → publication → public-reading loop while maintaining two-Junto isolation. Railway configuration is documented and stateless without performing a deployment.
- Proof: From a clean local reset, migrations, seeds, database tests, lint, typecheck, unit/integration tests, critical Playwright journeys, and production build all pass; focused adversarial checks verify denied cross-Junto access, deactivation, visibility revocation, metadata/sitemap behavior, and cache-safe private responses.
- Status: blocked

## Deferred and unresolved

- Deferred: comments and replies, member chat and realtime, meeting recordings, notifications, semantic search, tags, recommendations, version history, collaborative editing, native uploads, payments, and production deployment.
- Deferred: a general UI for creating new Juntos and bootstrapping the first production administrator; this run uses controlled fixtures and documents the later operational boundary.
- Deferred: exhaustive editorial polish, custom photography, dark mode, and nonessential animation.
- Unresolved: None. Thomas approved the canonical chapter routing and strict invitation-gated authentication decisions before implementation.
