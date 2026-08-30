# R04 re-reconciliation — corrected T02 public archive range

- Range: `a16b63504c66445b57ad11a296e0a3baffbd6efa..291af43b101dc38b81e4ab01f074c72116d16051`
- Verdict: **Pass; both R02 findings resolved; no new blocker**

## Resolution

1. **Date-only cross-chapter meeting mislabel — resolved.** `archiveFilterMessage` cannot consume a meeting title without `juntoSlug`. Chapter+meeting results receive conjunctively eligible essays and use a trimmed scoped title or neutral formatted-date fallback. Empty results are handled first; precedence is meeting, chapter, then author. The focused regression uses two chapters with distinct titles on the same date and is non-tautological.

2. **Configured-initial preference proof — resolved.** `orderChaptersByPreference` copies before sorting, retains every item, name-sorts non-preferred chapters, and moves only an exact match first. Root queries remain network-wide and feature selection exact-finds only within the eligible chapter result. Tests cover absent preference/no feature and exact match/no drop without duplicating the implementation logic.

No query, eligibility, parser, route, metadata, sitemap, fixture, documentation, dependency, schema, configuration, or portal behavior changed.

## Evidence limitations

No writable checks rerun in this read-only review. Credit C03/C05 independent `54 passed, 2 expected skips, 0 failed` reproductions; do not credit C02's original claim. Full 194/194 unit/component and production-build results remain Builder-reported. The prepared real live public-archive specification remains unexecuted.

## Recommendation

Integrate C05. Complete planned real Supabase/Auth public-archive desktop/mobile execution and fixture-absence verification during run integration.
