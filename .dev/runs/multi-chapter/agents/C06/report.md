# C06 report — final integrated-review correction

## Result

Closed both binding V01 blockers without changing multi-chapter behavior or
scope.

1. A genuine sitemap query exception now returns exactly the four static public
   URLs (`/`, `/essays`, `/authors`, `/meetings`) through the existing
   `buildPublicSitemap` seam. No dynamic or private entry is synthesized.
2. The authenticated new-chapter page now uses the existing unselected
   `PortalFrame` with the existing `SignOutButton`. The global skip link has a
   real `main#main-content` target, and the standard `JUNTO` / `Junto members
   only` shell is present before chapter creation continues.

All query eligibility, routes, data, auth, RLS, migrations, chapter creation,
public discovery, copy, fields, actions, fixtures, dependencies, and
configuration remain unchanged.

## Commit

- Base: `f4d0e4ab912251af9b9d20dea69ae84295baee2e`
- Result: `HEAD` — the exact immutable SHA is reported in the Builder handoff;
  this report is included in the same single commit, so it cannot contain its
  own hash.
- Commit count over base: exactly 1.

## Files changed

Exactly 6 files, all explicitly allowed:

- `src/app/sitemap.ts`
- `src/app/portal/chapters/new/page.tsx`
- `tests/unit/sitemap-route.test.ts` (new)
- `e2e/live/member-entry.spec.ts`
- `.dev/runs/multi-chapter/agents/C06/status.md`
- `.dev/runs/multi-chapter/agents/C06/report.md`

No shared run file, V01 artifact, documentation, migration, package/config,
lockfile, fixture, dependency, or unrelated file changed.

## Red/green evidence

- Sitemap red: the new actual-route test forced `listPublicJuntos` to reject;
  the catch branch returned `[]`, producing 1/1 focused failure with the four
  expected static URLs missing.
- Sitemap green: the actual-route regression plus the unchanged existing
  `public-sitemap` test passed 2 files / 3 tests. The new test asserts exact URL
  order and explicitly rejects chapter/detail/private/portal/draft/member
  markers.
- Portal red: after a fresh owned local Supabase reset, the real production-
  built member-entry story reached `/portal/chapters/new` on desktop and mobile;
  both projects failed specifically because `main#main-content` did not exist:
  18 passed, 2 failed, 8 did not run.
- Portal green: the same complete focused file passed 28/28 (14 desktop, 14
  mobile). Before creation, it proves visible `main#main-content`, skip-link
  `href="#main-content"`, the `JUNTO` link, `Junto members only`, and the `Sign
  out` control. The unchanged create → switch → settings → invitations →
  mailbox claims → scoped denials journey then completed.

An initial red live attempt with missing app environment was discarded because
it failed before the changed assertion. One post-fix attempt was also discarded
before discovery when Auth health returned 502 after reset; inspection showed
the owned gateway retained the recreated Auth container's old address. Restarting
only the owned gateway restored an independently probed HTTP 200 before the
successful run.

## Verification

- `pnpm install --frozen-lockfile` — passed; 516 locked packages installed and
  the lockfile stayed unchanged.
- `pnpm format:check` — passed.
- `pnpm lint` — passed with zero warnings (`--max-warnings=0`).
- `pnpm typecheck` — passed.
- Focused sitemap tests — passed: 2 files / 3 tests.
- Full `pnpm test` — passed: 30 files / 210 tests.
- Clean placeholder-env `pnpm build` — passed; compiled in 13.7s, TypeScript in
  7.9s, and both `/portal/chapters/new` and `/sitemap.xml` remain dynamic routes.
- Full stack-free `pnpm test:e2e` — passed: 54 passed, 2 expected desktop-only
  skips, 0 failed across desktop Chromium and Pixel 7 in 45.1s.
- Focused live `e2e/live/member-entry.spec.ts` — passed: 28/28 across both
  configured projects in 53.0s.
- Explicit `pnpm test:e2e:live:absence` — passed: 1/1.
- `git diff --check` and full-range allowed-file inspection — passed.

No database suite was rerun because no database code changed, as directed.

## Immediate-500 sitemap proof

An owned Python standard-library stub listened only on `127.0.0.1:4499` and
returned HTTP 500 for every request. Before Playwright, a direct
`/rest/v1/juntos?select=name` probe returned exactly HTTP 500. The complete
desktop/mobile stack-free suite then passed, including both sitemap cases,
which proved the browser-visible catch branch returns exactly the four static
locations with no dynamic/private marker. The stub was interrupted after the
run; ports 4499 and 3210 were immediately verified clear.

## Teardown proof

The focused live journey's exhaustive teardown passed, followed by the separate
1/1 fixture-absence assertion. `supabase stop --no-backup` succeeded. Final
read-only checks proved:

- 0 Junto Supabase containers;
- 0 `supabase_network_junto` networks;
- 0 `supabase_db_junto` volumes;
- 0 listeners on ports 3210, 3211, 4499, or 54320–54329;
- 0 owned Next, Playwright, Vitest, or stub processes;
- 0 generated Playwright test residue;
- `supabase status` exited nonzero because the local stack no longer exists.

## Self-reconciliation and blocker closure

Pass. The complete base-to-result diff was inspected against both V01 blockers,
the approved run/source scope, governing portal/public privacy rules, all prior
reports, and every stated boundary.

- Blocker 1 is closed at the actual route catch branch. Successful query
  behavior and every eligibility input are untouched; the exception fallback
  reuses the existing pure builder with empty eligible inputs.
- Blocker 2 is closed with the established unselected portal shell. Authentication
  and eligibility still run before rendering; form fields, copy, action,
  defaults, redirect, and chapter lifecycle are unchanged.
- The result adds no abstraction, compatibility path, dependency, fixture,
  configuration, refactor, dead/debug code, or unrelated cleanup.

No reconciliation gaps are known.

## Docs changed

None. Existing documents already require the implemented privacy and portal
shell behavior.

## Blockers or human decisions needed

None.

## Shape departure and deferred work

None.

## Proposed task-status, scope-map, or durable-learning updates

None.

## Additional relevant docs consulted

None beyond the assigned run source scope and project instructions.
