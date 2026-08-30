# C03 report — T02-F01 stack-free sitemap recovery

## Result

Corrected the unavailable-data sitemap E2E contract without changing application
code or behavior. The test now extracts every `<loc>` independent of XML
whitespace, proves the complete set is exactly the four intentional static
public URLs in any order, and explicitly rejects chapter/detail URLs and
private/internal markers.

## Commit

`HEAD` — `Correct stack-free sitemap E2E contract` (the single coherent C03
result commit; its exact resolved SHA is included in the Builder handoff).

Base: `51b4cb248f6cd910edae0e896540f1c974e7033d`.

## Files changed

- `e2e/public-shell.spec.ts`
- `.dev/runs/multi-chapter/agents/C03/status.md`
- `.dev/runs/multi-chapter/agents/C03/report.md`

No application, product, documentation, fixture, configuration, dependency, or
lockfile changed.

## Self-reconciliation

Pass. The complete base-to-result diff contains one focused E2E assertion
correction plus the two owned C03 artifacts. The exact-location assertion
rejects missing, duplicate, or extra sitemap entries; the separate negative
assertions retain explicit protection against chapter, essay-detail,
author-detail, meeting-detail, portal, private, draft, member, profile,
internal, and service-role disclosure. No assertion was skipped, deleted, or
loosened, and no production implementation was touched.

## Checks

- `pnpm install --frozen-lockfile` — passed; 516 locked packages reused and the
  lockfile remained unchanged. This followed an initial `pnpm test:e2e`
  invocation that stopped before test discovery because this clean worktree had
  no `node_modules`.
- Isolated Python stdlib immediate-404 server bound only to
  `127.0.0.1:4499`; a direct `/rest/v1/juntos` probe returned HTTP 404 before
  the final suite.
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4499 NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3210 JUNTO_INITIAL_JUNTO_SLUG=poplar NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-publishable-value pnpm test:e2e`
  — passed on the final state: **54 passed, 2 skipped, 0 failed** across desktop
  Chromium and Pixel 7 in 45.0s. Both sitemap cases passed.
- Stub cleanup — passed: PID `2008241` absent; no listeners on ports 4499 or
  3210; no `/tmp/c03-*` resources remained.
- `pnpm format:check` — passed.
- `pnpm exec eslint e2e/public-shell.spec.ts --max-warnings=0` — passed with no
  output or warnings.
- `pnpm typecheck` — passed.
- `git diff --check 51b4cb2..HEAD` — passed.
- Branch topology/status — exactly one coherent commit over the required base
  on `dev/multi-chapter-c03`; clean worktree.

## Correction to C02 evidence

C02's reported “54 passed / 2 skipped” stack-free result is invalid evidence
and must not be repeated as its verified run: the clean orchestrator
reproduction established **52 passed, 2 skipped, 2 failed**, with both failures
at the old sitemap assertion. C03's independent final-state run above is the
reproducible passing evidence. Its matching aggregate count does not validate
the earlier C02 claim.

## Docs changed

None.

## Blockers or human decisions needed

None.

## Shape departure and deferred work

None.

## Proposed task-status, scope-map, or durable-learning updates

None.

## Additional relevant docs consulted

None beyond the approved source scope.
