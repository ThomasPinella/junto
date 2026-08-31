# C01 Builder report

## Result

Implemented the approved chapter-application slice end to end. `/start-a-chapter` performs a bounded anonymous RPC submission with a honeypot and one-pending-per-normalized-email rule. `/portal/applications` is restricted in both server code and database RPCs to the exact verified `txpinella@gmail.com` identity. Approval locks the pending application and atomically creates a private active chapter, pending applicant `admin` invitation, and approval evidence; decline is durable. Applicant approval mail directs the applicant through the existing verified magic-link claim flow. Direct Resend REST notifications are server-only, use the approved fixed addresses, and report post-write delivery failures without undoing or misrepresenting durable state.

Commit: `HEAD` — the single coherent task commit (the immutable hash is reported by the Builder after commit creation).

## Checks

- Dependency integrity: `pnpm install --frozen-lockfile` passed; neither `package.json` nor `pnpm-lock.yaml` changed.
- Focused validation/action/data/email tests: 65 passed, including malformed/bounded inputs, safe error mapping, anonymous-client use, authorization-before-input, hardcoded Resend payloads, review-only links, verified-claim instructions, and fetch/HTTP/missing-key failures.
- Full unit/component regression: 32 files, 238 tests passed with `pnpm test`.
- Formatting, lint, and strict types: `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` passed; `git diff --check` passed.
- Local schema: `pnpm db:reset` applied all eight migrations, including the single additive chapter-application migration; `supabase migration list --local` showed local/remote-local alignment for all eight.
- pgTAP: 10 files and 451 assertions passed, including submit-only privacy, direct table denial, reviewer allow/deny and reviewer-before-input behavior, bounds, normalization, duplicates, approval/decline evidence, idempotency, slug collision, and forced invitation-failure rollback.
- Database harness safety: 186 assertions passed.
- Real local Supabase/Auth regression: 19 assertions passed.
- Supabase security advisor: no warning-or-higher issues.
- Stack-free browser regression: 62 passed and 2 intentional device-specific skips across desktop/mobile, including the public form, honeypot accessibility contract, navigation, reviewer denial, touch targets, and overflow.
- Focused real local Supabase/Auth browser journey: 2 passed (desktop/mobile), covering public submission, ordinary-user denial, exact-reviewer listing and POST decisions, atomic approval, applicant same-browser magic-link claim, correct active chapter admin access, durable decline, notification-failure honesty, and cleanup.
- Full real local Supabase/Auth browser regression: 132 passed across desktop/mobile.
- Explicit post-run fixture absence: 1 passed after the full live run; the local Supabase stack was then stopped cleanly.
- Production build: passed with controlled placeholder application values and emitted both `/start-a-chapter` and `/portal/applications`.
- Built-server probe: `/health` returned ready, `/about` returned 200, and the configured port was honored.

No hosted Supabase, Railway, Vercel, or Resend service was contacted. No real credentials were used.

## Documentation changed

- `.env.example` and `README.md`: document the fifth, server-only `RESEND_API_KEY`, local verification, routes, email prerequisite, and release proof.
- `docs/architecture/data-model.md`: documents private application records and atomic approval.
- `docs/architecture/authorization.md`: documents the anonymous submit-only exception and exact verified reviewer boundary.
- `docs/membership/authentication-and-membership.md`: documents the pending-admin-invitation and verified claim lifecycle.
- `docs/membership/juntos.md`: documents public proposal and private active chapter creation.
- `docs/experience/member-portal.md`: documents the reviewer-only portal surface and honest notification outcomes.

## Blockers and decisions

Blockers: None.

The production Resend key and verified `thomaspinella.com` sender remain an explicit human-owned release prerequisite; no credential was configured or tested against Resend in this run. The implementation deliberately keeps email post-transactional and surfaces delivery failure rather than adding an out-of-scope queue or rolling back durable application state.

## Shape departure and deferred work

The final result touches 39 files, including the two required agent report files, rather than the approximate 15–22. The core remains one table, three narrow RPCs, three direct feature modules, and two routes with no new package, service, service-role application path, generalized role/workflow layer, or unrelated refactor. The additional file count is direct evidence and governing-contract fan-out: existing env/health/public-boundary/route/nav/sitemap tests, desktop/mobile/live fixtures, and six required documentation surfaces each needed small focused updates.

Deferred work: only the explicitly out-of-scope release actions and prerequisites (validated Resend credential/domain, hosted migration, deployment, and hosted verification). No product or implementation behavior is deferred.

## Base-to-result reconciliation

Reconciled the complete `357ff635e29b7190435a7d002bbd85d3e9ffecdc..HEAD` result against the approved outcome and governing sources. The result preserves existing routes, records, Auth/invitation behavior, multi-Junto isolation, and public/private projections; adds exactly one forward-only migration and one server-only secret; derives identity at both authorization boundaries; exposes no application read path to anonymous or ordinary authenticated callers; creates no Auth user; preserves the reserved `sign-in` slug and existing slug bounds; and contains no GET decision link, real secret, package change, service-role application use, or excluded workflow feature.

## Proposed durable learning

Local Supabase CLI releases can emit generated publishable and service-role fixture keys that differ from older well-known demo values. Live Auth harness commands should load the current loopback-only values from `supabase status -o env` instead of assuming fixed keys, while retaining the existing loopback guards and never passing the service-role key to application code.

## Additional relevant docs consulted

None beyond the approved brief, its named governing sources, `AGENTS.md`, and the required Builder/Supabase/Next.js instructions.
