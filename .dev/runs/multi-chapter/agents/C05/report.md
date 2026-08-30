# C05 report — T02-F02/F03 reconciliation recovery

## Result

Closed both bounded R02 findings without changing public eligibility or scope.

- Date-only essay filters now use neutral formatted-date copy across same-date chapter meetings. A chapter-scoped meeting filter uses an eligible non-empty meeting title and otherwise falls back to the same neutral date copy.
- The configured initial chapter ordering preference now lives at the existing pure public archive domain seam. It preserves every supplied eligible chapter, prioritizes only an exact eligible match, and otherwise returns ordinary name order. Root feature selection remains an exact `find` over that eligible result and synthesizes nothing.
- Existing chapter-only, author-only, empty-filter-result, URL, attribution, metadata, sitemap, fixture, design, and public query behavior is preserved.

## Commit

`HEAD` — `Close public archive reconciliation findings` (the exact immutable result SHA is resolved and reported in the Builder handoff after this report is included in the single commit).

Base: `fa78062a2161673ed0a28b8926502cdc197baeba`.

## Files changed

- `src/lib/public-archive-domain.ts`
- `src/app/(public)/essays/page.tsx`
- `src/app/(public)/page.tsx`
- `tests/unit/public-archive-domain.test.ts`
- `.dev/runs/multi-chapter/agents/C05/status.md`
- `.dev/runs/multi-chapter/agents/C05/report.md`

## Explicit R02 closure

1. **Date-only meeting filter mislabel — closed.** The pure presentation helper never reads a meeting title for an unscoped date filter and returns `Showing essays from meetings on <formatted date>.`; the same-date two-chapter regression proves this. With both chapter and date selected, an eligible non-empty title is used, with neutral date fallback for an empty title.
2. **Configured-initial-slug proof gap — closed.** Focused tests prove an absent/private/ineligible configured slug (represented by absence from the supplied eligible set) retains the complete directory in name order and produces no exact feature match. A second test proves an exact eligible slug moves only that chapter first without dropping the remainder.

## Self-reconciliation

Pass. The complete base-to-result diff was inspected against both R02 findings, the approved T02 sources and shape, and every stated boundary.

- No public query, filter parsing, RLS/projection boundary, eligibility rule, URL, route, attribution, metadata, sitemap, live fixture, design, configuration, dependency, schema, migration, documentation, or private portal code changed.
- The only page changes replace presentation/ordering code with calls to focused pure helpers. `listPublicJuntos`, `listPublicEssays`, `listPublicMeetings`, anonymous-client use, and exact eligible-result feature selection are unchanged.
- The Next.js review retained async `searchParams`, Server Components, and existing parallel server reads. The React review found no new client boundary, hook, accessibility, serialization, waterfall, or rendering concern.
- No dead/debug code, generalized filter framework, speculative abstraction, unrelated cleanup, or out-of-scope file remains.

## Checks

- `pnpm install --frozen-lockfile` — passed; 516 locked packages reused and the lockfile remained unchanged.
- Focused red proof after dependency installation — passed as evidence: 3 new tests failed because the two helpers did not yet exist; 5 prior tests passed.
- `pnpm vitest run tests/unit/public-archive-domain.test.ts` — passed on final state: **1 file, 8 tests**.
- `pnpm test` — passed: **28 files, 194 tests**.
- `pnpm format:check` — passed; all matched files use Prettier style.
- `pnpm lint` — passed with zero warnings (`eslint . --max-warnings=0`).
- `pnpm typecheck` — passed.
- Clean placeholder-env production build with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4499`, `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3210`, `JUNTO_INITIAL_JUNTO_SLUG=poplar`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-publishable-value` — passed; compiled in 12.0s, TypeScript in 7.5s, and the dynamic `/`, `/essays`, chapter, detail, and sitemap routes remained in the manifest.
- Full `pnpm test:e2e` with the same environment against an owned Python stdlib immediate-404 stub bound only to `127.0.0.1:4499` — passed: **54 passed, 2 expected desktop-only skips, 0 failed** across desktop Chromium and Pixel 7 in 43.2s. The direct `/rest/v1/juntos` probe returned HTTP 404 first.
- E2E cleanup proof — passed: the owned test and stub process groups were terminated; no listeners remained on ports 4499 or 3210; the `/tmp/c05-e2e.*` temporary directory was absent.
- `git diff --check fa78062a2161673ed0a28b8926502cdc197baeba` — passed.
- Allowed-file and complete diff inspection — passed.

The initial pre-install focused command stopped before discovery because this clean worktree had no `node_modules`; it was superseded by the frozen install and the recorded red/green focused runs. A combined static/build invocation lost the build's terminal output after compilation began; the build was rerun separately and passed with a definitive exit and complete route manifest.

## Docs changed

None. Current normative documents already require coherent cross-chapter behavior.

## Blockers or human decisions needed

None.

## Shape departure and deferred work

None.

## Proposed task-status, scope-map, or durable-learning updates

None.

## Additional relevant docs consulted

None beyond the approved source scope.
