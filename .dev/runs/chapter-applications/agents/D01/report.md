# D01 production delivery report

**Application commit:** `e06e689feafcf2760c9d050f8bbb1991de062aa4`
**Railway deployment:** `04fa17c7-59f7-483f-9521-17b23ae92e7c`
**Completed:** 2026-08-31 08:31 UTC

## Delivery

- Fast-forwarded reviewed feature branch to `main` and pushed GitHub; local and `origin/main` matched at `e06e689` before final run-record commit.
- Streamed the existing validated Junto Resend credential into Railway production as `RESEND_API_KEY` over stdin with `--skip-deploys`; read-back confirmed presence and expected length without exposing the value.
- Supabase linked dry-run listed only `20260831043015_chapter_applications.sql`.
- Applied that migration to production. A post-apply pg-delta catalog-cache helper warned about a missing temporary certificate, but direct verification proved the migration completed.
- Explicitly deployed Railway from clean `main`; deployment reached `SUCCESS`.

## Production database verification

- Local and remote migration history both contain `20260831043015`.
- `public.chapter_applications` exists.
- All three RPCs exist.
- `juntos_slug_not_applications` is validated.
- `anon` and `authenticated` have no table DML privileges.
- Routine grants are bounded exactly as designed: anon submit; authenticated submit/list/decide; no service-role grant.
- Preflight confirmed no existing exact `applications` slug and an existing `txpinella@gmail.com` Auth user.

## Custom-domain verification

Verified on `https://juntoessays.com`, not only the Railway service URL:

- `/health` returned `{"status":"ready"}`.
- `/start-a-chapter` rendered the complete form and mailbox-verification disclosure.
- `/portal/applications` without a session resolved to the generic sign-in page and exposed no application data.
- `/sitemap.xml` contains `https://juntoessays.com/start-a-chapter`.

## Stateful production smoke proof

- Submitted one uniquely named disposable application through the public browser form.
- Browser redirected to `/start-a-chapter?status=submitted`, proving the durable write and reviewer notification success path rather than `submitted-notification-failed`.
- Direct production query found exactly one pending row with the expected normalized email.
- Deleted only that uniquely named smoke row and verified zero remain.
- Railway returned no application error logs and no HTTP 5xx for the deployment.

## External email note

The production smoke submission sent one generic reviewer notification to `txpinella@gmail.com`. An earlier local live-suite invocation may also have sent two generic reviewer test notifications before the production key was explicitly overridden with an invalid test-only value; this was recorded in C04 and the isolated rerun sent none.

## Result

Production delivery and exact-path verification passed.
