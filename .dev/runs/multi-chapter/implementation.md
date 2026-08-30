# Multi-chapter product flow

- Status: Proposed — awaiting Thomas's approval
- Rigor: Lean, with elevated rigor only at the chapter-bootstrap authorization boundary

## Goal

Turn Junto's existing multi-Junto schema and private URL scoping into a complete multi-chapter product flow:

- the public site provides a chapter directory, chapter-specific public home pages, and a network-wide view of public essays with every item labeled by chapter;
- authenticated admins can create a chapter, automatically become its first admin, and then use that chapter's existing invitation workflow to add member or admin accounts;
- authenticated users continue to choose and switch only among chapters where they have an active membership;
- the reviewed release is migrated and deployed to production, then verified on the canonical hosted origin.

## Decisions and boundaries

- Any authenticated user who is currently an active admin of at least one chapter may create another chapter. Junto will not gain a global super-admin or operator allowlist in this run.
- Chapter creation is one atomic database operation: create the `juntos` row and the creator's active admin membership together. A partial chapter without its first admin must be impossible.
- The creation form collects name, slug, optional description/location, and archive visibility. New chapters default to a private archive unless the creator explicitly chooses public.
- The selected chapter's Admin surface will expose bounded basic chapter settings (name, description, location, and archive visibility) using the existing chapter-scoped admin policy. Deletion and arbitrary ownership transfer remain out of scope.
- “Accounts under a chapter” continues to mean invitation-gated chapter memberships. Auth accounts remain global, so one verified person can belong to multiple chapters without duplicate accounts or passwords.
- Public visitors may discover only active chapters whose archive visibility is public. Private or inactive chapter names, counts, and metadata must not leak through selectors, pages, queries, metadata, or sitemaps.
- Login remains global and invitation-gated. Chapter choice happens after authentication and reveals only the user's active memberships; no pre-login selector will expose private chapter existence.
- `/` becomes the network overview: a public chapter selector/directory plus recent public essays across all active public chapters, each labeled and linked to its chapter. The configured initial chapter may remain editorially featured/first so production configuration does not need a breaking change.
- `/juntos/[juntoSlug]` becomes the public home for one active public chapter. `/essays`, `/meetings`, `/authors`, and author pages become coherent network-wide public indexes rather than silently restricting themselves to the initial chapter; chapter context is displayed where records could otherwise be ambiguous.
- Existing stable essay URLs (`/essays/[essaySlug]`), meeting URLs, member portal URLs, production records, and invitation history are preserved.
- No chat, public registration, member-created invitations, payments, recommendation feed, chapter deletion, custom chapter branding, or global administration is added.
- Thomas's request already authorizes merge, push, the additive production migration, Railway deployment, and live verification after this plan is approved and the run passes review. Escalation remains required for destructive data work, a material scope change, or an unforeseen security conflict.

## Expected shape

- Touches: one additive Supabase migration and its pgTAP coverage; chapter domain/data helpers; portal entry/layout/admin and a new chapter-creation route; public data queries, root/chapter/index pages, navigation/list presentation; focused unit and live Playwright coverage; relevant product/architecture docs.
- Magnitude: two coherent feature slices, approximately 20–30 changed or new files. The public slice should reuse the current editorial components and safe projections rather than create a parallel frontend.
- Introduces: one transactional chapter-bootstrap RPC and one public chapter landing route. No new dependency, table rewrite, service, secret, environment variable, global-role table, compatibility shim, or generalized tenancy framework.
- Compatibility: preserve all current production data and public content URLs. The migration is additive and forward-only. Existing external configuration remains valid; the root/index presentation changes intentionally from one-chapter-only to network-aware.

## Risks

- A chapter-bootstrap path could grant unauthorized admin rights if caller identity or eligibility is trusted from form input. The database RPC must derive `auth.uid()` and prove an existing active admin membership itself.
- Public aggregation could leak private/inactive chapters or members-only/draft content. Public reads must continue through anonymous RLS-safe chapter rows and the existing narrow public projections, with cross-chapter negative tests.
- Global essay/author URL assumptions could become ambiguous across chapters. Existing globally unique slugs are preserved; chapter labels and links provide context without changing stable URLs.
- Applying application code before the RPC migration would temporarily break chapter creation. Production sequencing will apply and verify the additive migration before releasing the dependent application build.

## T01 — Secure chapter creation and chapter administration

- Sources: `docs/membership/juntos.md`, `docs/membership/authentication-and-membership.md`, `docs/membership/user-roles.md`, `docs/architecture/data-model.md`, `docs/architecture/authorization.md`, `docs/experience/member-portal.md`, `docs/design/surface-guidelines.md`
- Depends on: None
- Outcome: An existing chapter admin can create a private-by-default chapter, becomes its first admin atomically, can edit bounded chapter settings, and can immediately invite member/admin email addresses under that chapter. Members, unauthenticated users, and admins without the required live authority cannot bootstrap a chapter.
- Shape: one migration/RPC plus focused portal/domain/UI changes and tests; reuse current membership and invitation architecture; no service-role browser path, global admin model, or destructive chapter action.
- Proof: pgTAP allowed/denied/atomicity and cross-Junto tests; unit validation tests; real local Supabase/Auth/Playwright journey covering create → switch → invite → mailbox-owned claim → correct chapter access, plus mobile accessibility/overflow checks.
- Status: ready after approval

## T02 — Public chapter discovery and network archive

- Sources: `docs/membership/juntos.md`, `docs/experience/public-archive.md`, `docs/architecture/authorization.md`, `docs/design/surface-guidelines.md`, `DESIGN.md`
- Depends on: None
- Outcome: Public visitors can choose an active public chapter, browse that chapter's page, and browse network-wide public essays/meetings/authors with explicit chapter attribution. Private/inactive chapters and non-public content remain uniformly absent.
- Shape: extend existing safe public data helpers and editorial pages/components; add `/juntos/[juntoSlug]`; no feed ranking, pagination system, new projection containing private fields, or generic design-system rewrite.
- Proof: focused unit tests for aggregate/filtered reads and attribution; live desktop/mobile Playwright covering chapter directory, chapter page, all-chapter essay list, labels/links, 404-safe private chapter behavior, no hidden markers, metadata/sitemap safety, and no horizontal overflow.
- Status: ready after approval

## Reconcile, review, and completion

- Integrate the two slices one at a time with focused checks after each.
- Run an independent specification/security reconciliation because the run changes a documented authorization boundary and public privacy scope.
- Run an independent read-only review over the complete baseline-to-head diff; accepted defects loop through a bounded fix cycle and incremental review.
- Final local proof: locked install; format check; lint; strict typecheck; unit tests; production build; database suites; stack-free E2E; live Supabase/Auth E2E twice; independent fixture-absence check; clean production-server probe; diff/whitespace checks; responsive/accessibility inspection.
- Production release: apply and verify the committed additive Supabase migration; merge/push `main`; observe Railway's deployment reach terminal `SUCCESS`; verify `https://juntoessays.com/health`, `/`, `/juntos/san-diego`, `/essays`, portal access behavior, public chapter labeling, private-table anonymous denial, migration parity, TLS/canonical redirects, and runtime configuration. Production verification will not create undeletable junk chapters; chapter creation is proven against the real local Supabase/Auth stack and the hosted RPC/catalog and route presence are verified non-destructively.
