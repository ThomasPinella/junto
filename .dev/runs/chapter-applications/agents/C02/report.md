# C02 Builder report

## Result

Reserved the exact chapter slug `applications` at every chapter-creation path that can collide with the static `/portal/applications` route. Both TypeScript creation schemas now reject it, the application-decision RPC rejects it after reviewer authorization, and the unshipped feature migration adds and explicitly validates an authoritative `juntos` check constraint. Exact nearby slugs such as `applications-circle` remain valid.

Failed reserved-slug approval is proven atomic: the application remains pending with no reviewer evidence, chapter, or invitation. Ordinary unauthorized bootstrap and approval probes still receive `42501` before reserved-input details.

Commit: `HEAD` — the single coherent C02 correction commit.

## Self-reconciliation

Reconciled the complete `42f4545..HEAD` result against the correction brief, governing documentation, source scope, and affected test boundaries. Every material change traces to the confirmed static/dynamic route collision. The result does not rewrite the deployed bootstrap migration or function, broaden the reserved set beyond exact `sign-in` and `applications`, change routes or email behavior, add dependencies or product behavior, or touch unrelated code.

## Checks

- Focused red proof: the new TypeScript cases initially failed only for exact `applications` in both schemas.
- Focused unit/action proof: 3 files, 41 tests passed.
- Fresh local migration application: `supabase db reset --local` applied all migrations through `20260831043015_chapter_applications.sql` successfully.
- Focused pgTAP: `chapter_bootstrap.test.sql` and `chapter_applications.test.sql` passed, 107 assertions total.
- Pre-existing-conflict migration proof: after resetting through `20260830065950`, a seeded `applications` chapter made `supabase migration up --local` fail at `validate constraint juntos_slug_not_applications`; the failed transaction left the conflicting row but no constraint or migration-history record (`1|0|0`). A subsequent full reset and focused pgTAP rerun passed.
- Full unit/component regression: 32 files, 240 tests passed.
- Static gates: `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` passed.
- Production build: passed with documented placeholder values and emitted `/portal/applications`, `/portal/[juntoSlug]`, `/portal/chapters/new`, and `/portal/sign-in`.
- Local database checks: `supabase db lint --local --schema public --level warning --fail-on warning` found no schema errors; local security advisors found no issues.
- `git diff --check` passed.

Dependencies were installed from the local pnpm cache with `--offline --frozen-lockfile`; no dependency or lockfile changed. All Supabase operations targeted the actual loopback-bound local stack. No hosted application project, deployment, email provider, or real credential was contacted.

## Documentation changed

- `docs/architecture/data-model.md` now identifies exact `sign-in` and `applications` as the reserved static portal slugs.

## Blockers and human decisions

None.

## Shape departure and deferred work

None. The correction matches the declared shape, and no in-scope work is deferred.

## Proposed task-status, scope-map, or durable-learning updates

None.

## Additional relevant docs consulted

None beyond the approved assignment, its named governing sources, `AGENTS.md`, `.dev/learnings.md`, and the required Builder and Supabase instructions.
