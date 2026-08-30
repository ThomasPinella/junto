# C02 report — T02 public chapter discovery and network archive

## Result

Implemented the approved T02 slice from base
`a16b63504c66445b57ad11a296e0a3baffbd6efa`:

- `/` is now an editorial network overview with an active-public chapter
  directory, optional configured-initial-chapter feature, and recent eligible
  public essays across chapters.
- Added `/juntos/[juntoSlug]` with metadata-safe uniform misses and
  meeting-led chapter proceedings.
- Made essay, meeting, and author indexes/details network-wide while preserving
  global essay/author URLs and chapter-scoped meeting URLs.
- Added explicit linked chapter attribution to every public essay row and
  chapter context to meeting/author/detail surfaces.
- Extended existing projection helpers for aggregate and validated optional
  chapter reads; chapter discovery explicitly filters active/public rows and
  public routes continue to use the cookie-free anonymous client.
- Added eligible chapter URLs to the dynamic sitemap and safe canonical chapter
  metadata. Existing dynamic essay revocation remains covered by the deferred
  live spec.
- Added focused unit, component, stack-free browser, and deferred live-spec
  coverage without changing fixtures, schema, dependencies, or configuration.

## Commit

`HEAD` — `Implement public chapter network archive` (the single coherent C02
handoff commit; exact SHA is reported by the Builder after commit creation).

## Self-reconciliation

Pass. Reviewed the complete base-to-result diff against T02, the declared
shape, governing docs, and source scope.

- All public-surface reads remain on `juntos` active/public narrow selects or
  the existing `public_essays` / `public_meetings` projections.
- Public routes use `createSupabaseAnonClient`; the deferred authenticated-
  browser live case is prepared to verify that a session cannot widen public
  results during orchestrator integration.
- Private/inactive chapters, base essay/meeting/profile/member reads, draft and
  members-only markers, private metadata/counts, migrations, and fixture edits
  are absent from the slice.
- The configured initial chapter affects ordering/feature selection only.
- The React review found no unnecessary client boundaries/state; independent
  reads are parallel, dynamic detail loads are request-deduplicated, and
  cross-chapter date keys are composite.
- No dead styles from the replaced single-chapter homepage, debug code, new
  dependency, pagination/filter framework, ranking behavior, or unrelated
  refactor remains.
- `.dev/` changes are limited to this C02 report and status.

## Checks

- `pnpm install --frozen-lockfile` — passed; 516 packages reused, lockfile
  unchanged.
- `pnpm format:check` — passed; all matched files use Prettier style.
- `pnpm lint` — passed with zero warnings.
- `pnpm typecheck` — passed.
- `pnpm test` — passed: 28 test files, 191 tests.
- `pnpm build` — passed: compiled in 12.6s, TypeScript in 7.7s; dynamic `/`,
  `/essays`, `/authors`, `/meetings`, `/juntos/[juntoSlug]`, scoped meeting
  routes, and `/sitemap.xml` present in the route manifest.
- Stack-free `pnpm test:e2e` with command-scoped valid site configuration and
  an isolated loopback HTTP 404 stub (never C01's Supabase port) — passed: 54
  tests, 2 expected desktop-only skips, 47.3s; desktop and Pixel 7 projects.
- `git diff --check` — passed.

Evidence-loop failures were resolved rather than hidden: the first production
build exposed overly broad existing typed-route return types and the first
browser run exposed an ambiguous masthead locator. Both were narrowed and
reverified. A connection-refused failure endpoint also caused transient retry
churn and a later test-server exit; the final exact suite used an isolated
immediate-404 loopback stub and passed completely.

### Deliberately deferred live execution

`pnpm test:e2e:live`, database tests, and all local Supabase lifecycle commands
were not run, exactly as required while C01 owns the shared stack. The updated
`e2e/live/public-archive.spec.ts` reuses existing multi-Junto fixtures and covers
the active Poplar/Elm directory and archive, private Cedar/inactive Quince
misses, authenticated public-route parity, stable URLs, chapter labels/links,
metadata/sitemap exclusions, revocation, responsive overflow, and touch
targets. Execution is assigned to orchestrator integration after C01.

## Docs changed

- `docs/membership/juntos.md` — made the root network overview and chapter
  discovery/privacy behavior normative.
- `docs/experience/public-archive.md` — specified network-wide indexes,
  chapter homes/attribution, stable URL shapes, and uniform chapter misses.
- `docs/architecture/authorization.md` — specified identical anonymous public
  eligibility for signed-in and signed-out browsers.
- `docs/design/surface-guidelines.md` — clarified network masthead/directory and
  linked chapter attribution within the existing editorial system.

## Blockers or human decisions needed

None. Run-level live execution remains intentionally assigned to integration,
not blocked product work.

## Shape departure and deferred work

None. The implementation follows the declared public-helper/page/component,
metadata/sitemap, focused-test, and owned-doc shape. No migration, fixture
change, dependency, new configuration, schema/projection expansion, design
rewrite, pagination system, or public registration was added.

Deferred outside this Builder: execute the prepared live public archive spec
after C01 releases the shared stack, then perform run-level reconciliation,
review, integration, and deployment evidence.

## Proposed durable learning

For stack-free SSR browser suites against Supabase, use an isolated loopback
stub that returns an immediate non-retryable response rather than a refused
connection. Connection refusal activates transient PostgREST retries on every
render, needlessly lengthens evidence runs, and can destabilize a long-lived
test server without increasing privacy coverage.

## Additional relevant docs consulted

- `https://supabase.com/docs/guides/api/sql-to-api` — the “Select statement with
  basic clauses” examples confirmed the current chained filter/order/limit
  usage for aggregate and optional scoped projection reads. Decision: retain
  the existing Supabase query-builder seam; affected `src/lib/essays.ts`,
  `src/lib/meetings.ts`, and focused data tests. Proposed `source-docs.md`
  scope: none; vendor API reference, not a product-governing source.
- `https://supabase.com/docs/guides/api/automatic-retries-in-supabase-js` — the
  built-in retry behavior confirmed the need to retain request-wide abort
  signals and informed the final isolated immediate-404 stack-free harness.
  Affected public data helper verification only. Proposed `source-docs.md`
  scope: none; vendor operational reference, not a product-governing source.
