# Chapter applications

- Status: Approved by Thomas on 2026-08-31
- Rigor: Lean, with elevated rigor only at the public-write and superadmin decision boundaries

## Goal

Add a small public “Start a chapter” application flow. A prospective organizer submits a chapter name, location, email, and short note. Junto stores the application privately and emails the hardcoded reviewer `txpinella@gmail.com`. Thomas reviews pending applications inside the authenticated portal. Approval creates the chapter and a pending administrator invitation; after the applicant verifies the submitted email through Junto’s existing magic-link flow, their global account is created/activated and the invitation makes them that chapter’s administrator.

## Decisions and boundaries

- The public canonical route is `/start-a-chapter`, linked as “Start a chapter” from the publication navigation.
- Public fields are chapter name, city/location, applicant email, and one bounded free-text note about the proposed chapter. No biography, phone number, attachments, scheduling, or multi-step intake.
- Applications are durable private records. Anonymous callers may submit only through one bounded database RPC and may never list or read applications. Direct table access is not a public API.
- The exact verified reviewer email is hardcoded as `txpinella@gmail.com`. This run does not add a global-role table, general staff system, configurable approval matrix, or public application status lookup.
- Review happens at `/portal/applications`. Both the server surface and database mutation boundary independently require an authenticated Supabase identity whose verified email normalizes to the hardcoded reviewer address.
- Email scanners must not make decisions: notification email links open the authenticated review surface; approval and decline require explicit POST actions.
- Approval is atomic at the database boundary: lock one pending application, create one private active chapter, create one pending `admin` invitation for the applicant, and mark the application approved with its chapter and reviewer evidence. A collision or failure leaves the application pending and creates no partial chapter/invitation.
- The reviewer may confirm/edit the derived chapter slug at approval. Existing chapter slug bounds and reserved `sign-in` behavior remain authoritative.
- Junto will not create an unverified Auth account. Approval emails the applicant a link to Junto’s sign-in surface. The existing mailbox-owned magic-link callback creates/activates the account, claims the matching admin invitation, and grants chapter access. This verification click is the only required applicant follow-up.
- Decline marks the application declined. A short applicant notification is sent after the durable decision.
- Custom email uses the Resend REST API directly, with no package dependency. The only new application secret is `RESEND_API_KEY`; sender is hardcoded as `Junto <applications@thomaspinella.com>`. The key is never exposed to browser code or committed.
- Application submission is lean anti-abuse: strict bounds, one pending application per normalized email, and a honeypot. CAPTCHA, generic rate-limiting infrastructure, workflow automation, reminders, dashboards, and bulk actions are out of scope.
- Existing production records, Auth users, invitations, memberships, URLs, and public/private behavior are preserved. The migration is additive and forward-only.
- Thomas’s approval authorizes merge to `main`, push, additive Supabase migration, Railway configuration/deployment, and live verification. A valid Resend key/domain remains a concrete deployment prerequisite; the previously stored portfolio key currently returns HTTP 401 and will not be deployed.

## Expected shape

- Touches: one additive Supabase migration and pgTAP coverage; chapter-application validation/data/email modules; one public form route; one private reviewer route and actions; public navigation/routes; focused unit and desktop/mobile E2E; environment and architecture/membership documentation.
- Magnitude: one coherent feature slice, approximately 15–22 changed or new files. Reuse existing publication, portal, Supabase, invitation, and Auth callback patterns.
- Introduces: one private `chapter_applications` table, bounded submit/list/decide RPCs, `/start-a-chapter`, `/portal/applications`, and one server-only `RESEND_API_KEY`. No service-role key, new dependency, background worker, queue service, generalized workflow engine, global-role table, one-click GET decision, or compatibility shim.
- Compatibility: preserve all existing production data and routes. The additive migration can be applied before the app; old application instances remain valid during deployment.

## Risks

- A public submission path could leak applicant emails/notes or become a general write/read API. RLS, grants, narrow SECURITY DEFINER functions, bounds, and anonymous negative tests must enforce submit-only behavior.
- A client-supplied reviewer identity or decision GET could allow unauthorized chapter creation. The decision RPC must derive the authenticated verified email itself and perform the decision transaction atomically.
- Approval could create a chapter without a usable administrator if invitation creation is not atomic. Chapter, pending admin invitation, and application decision must commit or roll back together.
- Sending email after a durable write can fail. The UI must report notification failure honestly without rolling back or misreporting the database decision; no fake success claim.
- Reusing a revoked or unverified Resend credential would make the live form incomplete. Production deployment requires a validated API key and verified `thomaspinella.com` sender.

## T01 — Implement and ship chapter applications

- Sources: `docs/architecture/data-model.md`, `docs/architecture/authorization.md`, `docs/membership/authentication-and-membership.md`, `docs/membership/juntos.md`, `docs/experience/member-portal.md`, `docs/design/surface-guidelines.md`, `DESIGN.md`, `.env.example`, `README.md`
- Depends on: None
- Outcome: A public visitor can submit a minimal chapter application; only Thomas’s verified hardcoded account can review and decide it; approval creates a private chapter plus pending admin invitation atomically; verified applicant sign-in claims that invitation; submission and decision emails are sent from the configured Resend integration.
- Shape: one migration plus direct feature modules/routes/tests and small documentation/config updates; no new package, service-role path, workflow framework, public application read, or unrelated refactor.
- Proof: focused validation/action/unit tests; pgTAP allowed/denied/privacy/atomicity/idempotency assertions; email HTTP mock tests; stack-free desktop/mobile form and portal-shell checks; real local Supabase/Auth desktop/mobile journey covering submit → reviewer denial/allow → approve → applicant magic-link claim → chapter-admin access, plus decline and notification-failure behavior; full static/build/database/Auth regression gates.
- Status: ready

## Reconcile, review, and completion

- One high-effort Codex Builder owns the coherent slice in an isolated worktree and produces one reviewed commit.
- Run an independent read-only specification/security reconciliation because the feature introduces a public write and hardcoded global reviewer exception.
- Run an independent read-only review over baseline → integrated head. Accepted defects loop through one bounded fix assignment and incremental review.
- Final proof uses the repository’s real format, lint, typecheck, unit/component, build, database/Auth, stack-free, live desktop/mobile, fixture-absence, and teardown paths.
- Release applies and verifies the additive hosted migration before dependent application deployment, sets only a validated `RESEND_API_KEY`, pushes exact reviewed `main`, waits for Railway terminal success, and verifies canonical public/reviewer routes, email delivery, private application denial, approved applicant Auth/admin activation, no fixture residue, and clean runtime logs.
