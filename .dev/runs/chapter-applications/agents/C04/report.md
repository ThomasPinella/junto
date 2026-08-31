# C04 correction report

**Commit:** `5b44733a` (`fix: accept database-valid application emails`)
**Completed:** 2026-08-31 08:13 UTC

## Root cause

The authoritative SQL table/RPC boundary accepts bounded normalized values including `a@b.c`, but reviewer-side stored-row schemas reused the public form's stricter `z.email()` parser. An anonymous direct RPC caller could persist a database-valid value that poisoned reviewer listing or made a committed decision appear to fail during response parsing.

## Correction

- Changed stored `applicant_email` parsing to `z.string()` in both reviewer listing and decision result schemas.
- Kept public form validation strict and left the SQL contract unchanged.
- Added unit coverage for listing and durable-decision results containing `a@b.c`.
- Added four pgTAP assertions covering anonymous RPC submission, reviewer listing, decision response, and durable decline for `a@b.c`.

## Verification

All executed on the exact corrected tree:

- Focused unit: 20/20 passed.
- Focused chapter-application pgTAP: 64/64 passed.
- Format, typecheck, lint, and `git diff --check`: passed.
- Full unit/component: 243/243 passed.
- Full pgTAP: 467/467 passed.
- Auth harness safety: 186/186 passed.
- Real local GoTrue/Auth: 19/19 passed.
- Production Next.js build: passed.
- Production process proof: `/health` 200 ready, `/about` 200, listener cleaned up.
- Stack-free Playwright: 62/62 passed with 2 intentional skips when invoked with its exact `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3210` origin. The first invocation's only two failures were the known `.env.local` origin mismatch.
- Live Playwright: 132/132 passed with `RESEND_API_KEY=invalid-test-only-key` to exercise the intended notification-failure branch without external mail.
- Post-run fixture absence: 1/1 passed.
- Local Supabase and application servers stopped; no listeners remained on 3210, 3211, or 54321–54324.

## Environment notes

The first live invocation inherited the newly validated real Resend key from `.env.local`, so its two chapter-application assertions observed successful notification instead of the intended failure state; 130 other checks passed. That invocation may have sent two generic reviewer test emails. The clean reset/rerun explicitly overrode the key with an invalid test-only value and passed all 132 checks without external delivery.

## Residual concern

None in the correction. Final incremental independent review remains required before deployment.
