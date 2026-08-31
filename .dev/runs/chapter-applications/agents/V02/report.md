# V02 final release review

**Reviewer:** Claude Code Opus (read-only)
**Reviewed range:** `2f9aebe237445128a0fd58e72e1bcd4635d5b08a..150e76cf154555427401daa24f6a5219ce82fa66`
**Completed:** 2026-08-31 07:46 UTC

## Verdict

**FAIL — correction required.**

## Qualifying finding

The public database contract and reviewer-side row schemas accept different email domains:

- `submit_chapter_application` and the table constraint accept bounded values matching `^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$`.
- `applicationRowSchema` and `decisionRowSchema` parse the stored value with Zod's stricter `z.email()`.
- An anonymous direct RPC caller can therefore persist a value such as `a@b.c` that is valid at the database boundary but makes `listChapterApplications()` throw, taking `/portal/applications` down for every application.
- The same mismatch can cause a decision transaction to commit and then fail response parsing, producing a false "Nothing was changed" message after durable approval/rejection.

## Required correction

1. In `src/lib/chapter-applications.ts`, parse stored `applicant_email` as `z.string()` in both reviewer-row schemas. The database already owns normalization, bounds, and accepted-format enforcement.
2. Add regression coverage proving a DB-valid/Zod-email-invalid value submitted through the anonymous RPC remains listable and decidable without false failure reporting.
3. Re-run all affected tests and the full required gates.

## Non-qualifying observations

- Reviewer access does a redundant Auth lookup and loads memberships the route does not use.
- Approved rows link to chapter admin even though the reviewer intentionally has no membership; the live spec currently asserts the redirect.
- `loadSiteEnv()` sits outside the email send `try`, but `/health` makes invalid site URL configuration undeployable.

## External release checks

The reviewer noted sender/key, hosted slug collision, and hosted reviewer-account existence as release checks. During orchestration, the exact Resend sender was subsequently accepted with provider message ID `e324f41d-18cf-496f-ac10-869d294367f9`; the migration's transactionally validated constraint remains the authoritative hosted-slug guard.
