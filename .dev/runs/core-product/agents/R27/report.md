# R27 run-level specification reconciliation

## Verdict

**Needs fixes.** T01–T08 are integrated and substantially aligned, but one completion-blocking evidence-integrity gap remains in the standalone T02 Auth harness. Three statements across two governing documents require bounded authoritative correction.

## Exact range

Reviewed `58c0848e502d986802d19f93d882756964a5fa0c..b0fe62449a66545ce2e9c6e386b9af8f4635f617` on `dev/core-product`. Baseline is an ancestor; all accepted T01–T08 results/fixes are present. Only declared `.dev` bookkeeping was dirty. The reconciler made no edit, service/suite start, Railway/Supabase call, or remote action.

## Alignment summary

- T01: Next App Router/strict TypeScript/pnpm, four-variable validation, public/portal shells, accessibility tokens, scripts/build.
- T02: six migrations, profiles/Juntos/invitations/memberships, RLS, verified-email claims, pre-user hook, active memberships as sole durable authority; real service proof exists subject to the harness gap.
- T03: real mailbox/PKCE entry, invitation claim, switching, scoped authorization/navigation, generic denials, immediate deactivation.
- T04: Junto-scoped meetings, admin lifecycle/no delete, safe public projection.
- T05: author ownership, same-Junto meeting integrity, stable slugs, status/visibility, literal confirmation, safe public projection/Markdown.
- T06: own-author workspace, preview/save/publication, privacy-first withdrawal/content-first exposure, truthful partial outcomes.
- T07: configured publication archive/essay/author/meeting routes, anonymous projections, generic misses, dynamic metadata/sitemap, revocation, responsive 44px proof.
- T08: four variables/no app service role, stateless Railway/PORT/health, isolated archive/process cleanup, separate human operations.

Deferred comments, chat/realtime, recordings, notifications, search/tags, recommendations, likes/reactions, payments, general bootstrap UI, and deployment remain excluded.

## Findings

### Medium — completion-blocking standalone Auth harness validation

`supabase/tests/auth/verify-mailbox-ownership.mjs` validates only outer `users`/`messages` arrays, then treats malformed nested elements as absence: user entries are not required to have valid `id`/`email`; message entries are not required to have `ID`, `To`, and recipient `Address`; detail `Text`/`HTML` are coalesced instead of validated. Cleanup/absence reuse these readers. `harness-safety.test.mjs` tests malformed outer containers but not malformed nested entries.

Impact: `{"users":[{}]}` or `{"messages":[{}]}` under HTTP 200 can be interpreted as no fixture, invalidating the standalone 19-check Auth harness's absence claim and violating the durable strict nested-success rule.

Smallest fix: port the strict nested parsers from live fixtures into the standalone harness; add closed-world malformed user ID/email, message ID/recipients/address, and detail Text/HTML cases; rerun safety, genuine Auth, cleanup/absence, and cumulative gates.

### Medium — authorization source is broader than accepted behavior

`docs/architecture/authorization.md` says anonymous users may read profiles associated with public essays, but implementation grants no anonymous base-profile access and exposes only public-essay-derived `author_name`/`author_slug`. It also broadly implies administrators may update/delete other authors' essays, while accepted behavior has no delete and no administrator body rewriting—only bounded metadata/publication moderation.

Fix: document narrow public-essay-derived author identity/no public profile read; author-only body editing; bounded admin metadata/visibility moderation; no essay-delete path in this slice.

### Low — essay status vocabulary conflict

`docs/architecture/data-model.md` lists `archived`, while governing essay content, plan, and schema use only `draft | published`.

Fix: remove `archived` or mark it explicitly deferred/non-MVP.

## Evidence and residual risks

All other supplied evidence is consistent: 181 unit, 353 pgTAP, 109 safety, 19 genuine Auth, stack-free 52 + 2 skips, live 122, absence, isolated archive health/about, and process/listener cleanup. Live E2E parsers and all six teardown owners are strict/exhaustive; the gap is only the older standalone harness.

After correction, remaining non-blocking risks: hosted migrations/Auth/SMTP/Railway/deploy are human operations; public owner-rights views require privacy review for future column additions; archive/sitemap cap is 100; no committed seed or production bootstrap automation exists.

## Recommendation

Do not complete yet. Apply the bounded harness and governing-document corrections, rerun relevant and cumulative proof, then perform focused reconciliation/review. No feature expansion or deployment is needed.
