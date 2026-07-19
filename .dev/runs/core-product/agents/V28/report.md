# V28 engineering and release review

## Verdict

**Safe to hand off as a deployable release candidate.** The approved `core-product` code is deploy-ready but has not been deployed or production-bootstrapped. Hosted Supabase setup, migrations, Auth-hook/email configuration, initial bootstrap, Railway variables/deploy, and hosted smoke tests remain separately approved operations.

## Blocking findings

None. No release-blocking correctness, authorization, privacy, database-integrity, test-integrity, or deployment-configuration defect was found.

## Non-blocking findings

1. Public archive and sitemap queries cap results at 100 without pagination. At future scale, older essays can disappear from browsing/sitemap while stable direct URLs remain valid. Add cursor pagination and segmented sitemap generation before this becomes realistic.
2. Production bootstrap must explicitly enable the hosted Supabase before-user-created hook and email confirmations. Migrations create the hook function, but hosted Auth configuration is operational. Omitting it can permit uninvited Auth-user creation, although RLS still prevents membership/private access. README documents the prerequisite; operators must verify it.
3. `/health` intentionally checks process/environment shape—not Supabase reachability, migrations, or Auth-hook configuration. This is honest and appropriate for Railway process readiness, but hosted anonymous-read and invited-auth smoke tests remain mandatory operations.

## Review and evidence

Read-only review covered the governing product/architecture/authorization/design/scope/journey/run documentation; all 31 baseline-to-candidate commits; six migrations and their constraints/grants/RLS/security-definer boundaries; portal/auth/admin/meeting/essay behavior; anonymous projections, dynamic public routes, metadata/sitemap, Markdown, and privacy-first withdrawal; unit/pgTAP/Auth/harness/Playwright sources and cleanup; and Railway/env/health/archive/process-group readiness.

Supplied exact-HEAD execution evidence was internally consistent: format, zero-warning lint, typecheck, 181 unit, production build, six-migration reset, 353 pgTAP, 109 safety, 19 genuine Auth/Mailpit, stack-free 52 + 2 intended skips, live desktop/mobile 122, absence 1, isolated archive install/build/start, health/about 200, TERM-resistant process cleanup, loopback inspection, and checked teardown. Suites/services were not rerun by the read-only reviewer.

## Repository state

Reviewed exactly `58c0848e502d986802d19f93d882756964a5fa0c..b0fe62449a66545ce2e9c6e386b9af8f4635f617` on `dev/core-product`. Only disclosed shared `.dev` bookkeeping was dirty. The reviewer made no edits, commits, deployment/migration/service action, or remote call.

## Recommendation

Complete the engineering run and hand off exact candidate `b0fe62449a66545ce2e9c6e386b9af8f4635f617`. Production bootstrap and deployment remain separate explicit decisions, with hosted Auth hook and email-confirmation verification required.
