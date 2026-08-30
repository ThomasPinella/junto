# R02 reconciliation — T02 public chapter discovery/network archive

- Range: `a16b63504c66445b57ad11a296e0a3baffbd6efa..fa78062a2161673ed0a28b8926502cdc197baeba`
- Verdict: **Bounded correction requested before integration**

## Evidence inspected

Exact one-commit C02 product range plus one-commit C03 test correction; complete diff, governing docs, reports, public routes/helpers, existing RLS/projection definitions, and focused/unit/browser/live specifications. Worktree clean and full-range diff check clean. No writable checks rerun.

No privacy, authorization, stable-URL, schema, dependency, fixture, scope, or private-portal defect was found.

## Findings

### 1. Moderate — date-only meeting filter can mislabel cross-chapter results

`meeting` is a valid filter without `junto`, so `/essays?meeting=YYYY-MM-DD` intentionally aggregates all eligible meetings on that date. The result page currently labels the aggregate using the first essay's meeting title. When two chapters meet on the same date, essays from both can appear under one chapter's meeting title.

This conflicts with coherent cross-chapter archive presentation and fits approved scope.

**Smallest correction:** keep the date-only aggregate, but label it as meetings on the formatted date; show a meeting title only when a chapter is also selected. Add a focused same-date cross-chapter regression. No schema, route, or new filter framework.

### 2. Low — configured-initial-slug fallback lacks direct proof

The implementation correctly derives ordering and feature selection from the already eligible chapter set, so a private/inactive/absent configured slug cannot widen or restrict discovery. No focused test directly combines an absent configured slug with other eligible chapters and proves the full directory remains present.

**Smallest correction:** add a pure focused test for ordering/feature selection when the configured slug is absent from the eligible set. This is an evidence gap, not an observed implementation failure.

## Evidence accuracy

- C02's claimed stack-free `54 passed / 2 skipped` result is invalid and must not be credited.
- The valid pre-correction reproduction was `52 passed / 2 skipped / 2 failed`.
- Credit C03's independent corrected result only: `54 passed / 2 expected skips / 0 failed`.
- The prepared live public archive specification has not yet executed and is not runtime evidence.

## Recommendation

Correct both bounded presentation/proof findings through a new Builder, then integrate. Run-level live Supabase/Auth desktop/mobile execution with cleanup and fixture-absence verification is sufficient remaining T02 follow-up.
