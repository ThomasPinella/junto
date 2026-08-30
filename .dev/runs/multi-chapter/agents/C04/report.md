# C04 report — T01-F01/F02 reconciliation fixes

## Result

Closed both R01 findings without expanding T01:

- the application parser rejects exactly `sign-in` through the existing
  `slug-invalid` form contract while continuing to accept normal valid slugs;
- the authorization-first bootstrap RPC rejects `sign-in` as `22023` only
  after proving a live active admin membership;
- an additive `NOT VALID` table constraint rejects the reserved slug on future
  direct writes, including updates, without scanning, rewriting, or rejecting
  existing rows when the migration is applied;
- pgTAP independently proves that ordinary and inactive callers receive
  `42501` before existing-private-slug, malformed-slug, reserved-slug, and
  all-null validation/uniqueness behavior, and full-table snapshots prove each
  caller's attempts create or alter no chapter or membership rows.

No chapter bootstrap, global-account, route, authorization-ordering, migration,
or exception-mapping behavior changed beyond the reserved slug. No T02/public
work, fixture change, role, dependency, configuration, refactor, deployment,
push, or merge was introduced.

## Commit

- Base: `66ae231d453e495f01ebd7c60bd375072c68f245`
- Result: the sole commit over base on `dev/multi-chapter-c04`. Its exact
  immutable SHA is reported in the Builder handoff because this report is part
  of that commit and a commit cannot contain its own hash.

## Files changed

- `src/lib/chapter-domain.ts`
- `tests/unit/chapter-domain.test.ts`
- `supabase/migrations/20260830065950_chapter_bootstrap.sql`
- `supabase/tests/chapter_bootstrap.test.sql`
- `docs/architecture/data-model.md`
- `.dev/runs/multi-chapter/agents/C04/status.md`
- `.dev/runs/multi-chapter/agents/C04/report.md`

## Exact checks and outcomes

- `pnpm install --frozen-lockfile` — passed; 516 locked packages installed and
  the lockfile remained unchanged.
- Targeted `pnpm exec vitest run tests/unit/chapter-domain.test.ts` — passed:
  1 file, 15/15 tests. The new focused test rejects exact `sign-in` and accepts
  `sign-in-circle`.
- `pnpm format:check` — passed after formatting the changed unit file.
- `pnpm lint` — passed with zero warnings (`--max-warnings=0`).
- `pnpm typecheck` — passed.
- `git diff --check` — passed.
- Clean `pnpm db:reset` — passed; all 7 migrations applied through
  `20260830065950_chapter_bootstrap.sql`.
- Focused
  `supabase test db supabase/tests/chapter_bootstrap.test.sql` — passed: 1 file,
  45/45 assertions.
- Full `pnpm test:db` — passed: pgTAP 9 files / 398 assertions; Auth harness
  safety 186/186; real GoTrue mailbox-ownership regression 19/19.
- `supabase db advisors --local --fail-on error` — no issues.
- `supabase db lint --local --fail-on error` — no schema errors.
- `supabase migration list --local` — all 7 local migrations present in local
  history.
- Installed-constraint inspection —
  `juntos_slug_not_reserved|f|CHECK ((slug <> 'sign-in'::text)) NOT VALID`,
  confirming additive upgrade posture and new-write enforcement.

## Reset and cleanup evidence

Before startup, `docker ps` and listener inspection found no Supabase containers,
network, or listeners on ports 54320–54329; one stopped-stack backup volume from
the prior local instance existed. The first start attempt failed its health gate
on optional analytics/vector services and automatically stopped. A single
recovery start with vector excluded became healthy; Auth, PostgREST, Mailpit,
and Postgres remained present for the reset and full test run.

After verification, `supabase stop --no-backup` completed. Final Docker checks
found no `supabase_*_junto` containers, `supabase_network_junto` network, or
`supabase_db_junto` volume. Listener inspection found nothing on application
ports 3000/3210/3211 or Supabase ports 54320–54329. `supabase status` failed only
because `supabase_db_junto` no longer exists, corroborating complete teardown.
No development or production application server was started.

## Self-reconciliation

Reconciled the complete base-to-result diff against the recovery assignment,
R01, the approved T01 shape, governing docs, source scope, and the original C01
report. The reserved check in `bootstrap_junto` remains below the live-admin
authorization branch. The table constraint is additive and `NOT VALID`, so the
migration neither scans nor rewrites existing rows; it prevents any later
trusted/direct update from introducing the route collision. Both `22023` from
the RPC and `23514` from the constraint already map to the same safe
`input-invalid` write error, while unauthorized callers retain `42501` and
`not-permitted`.

The final diff stays within all allowed files and is the smallest coherent
correction: one parser refinement, one RPC discriminator, one table constraint,
focused unit/pgTAP proofs, and one governing-doc sentence. It adds no dead/debug
code, abstraction, dependency, compatibility layer, fixture, or unrelated
cleanup. The misleading “pre-existing” pgTAP label now accurately says the
rows are suite seed rows; upgrade safety is established by migration structure
and installed constraint state, not by those fixtures.

## Explicit R01 resolution

1. **Reserved `sign-in` route collision — resolved.** Application and database
   boundaries reject exact `sign-in`; normal valid slugs remain accepted; the
   table constraint covers future direct updates.
2. **Authorization-before-validation regression gap — resolved.** Ordinary and
   inactive callers each prove `42501` wins over private existing-slug,
   malformed, reserved, and null probes, with unchanged chapter/member table
   snapshots.

## Docs changed

- `docs/architecture/data-model.md`, “Atomic Junto bootstrap” — records exact
  `sign-in` reservation at the existing metadata-boundary seam.

## Blockers or human decisions needed

None.

## Shape departure and deferred work

Implementation shape departure: None.

Deferred as outside this recovery: all T02/public work and every broader T01
feature or refactor.

## Proposed durable learning

None. The existing run learning proposed by C01 already captures privileged
creation authorization-before-validation ordering.

## Additional relevant docs consulted

None. No project document beyond the assigned Builder contract, run scope,
reports, and T01 governing source set materially changed the implementation
decision.
