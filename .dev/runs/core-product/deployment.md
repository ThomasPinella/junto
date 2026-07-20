# Production deployment

## Release identity

- Product/run commit merged to `main`: `b6d898d9cdea99fd73b9cae34370bd22bcec0078`.
- GitHub remote: `ThomasPinella/junto`, branch `main`.
- Deployment authorized and performed: 2026-07-20.

## Railway

- Project: `Junto` (`b3d20dca-6c81-40d1-8267-f158b6b04172`).
- Service: `web` (`3d9b4024-fd77-4550-95e3-f19e65bcdec6`).
- Environment: `production`.
- Public origin: `https://web-production-7724e.up.railway.app`.
- Region: US East, one stateless replica.
- Source: GitHub `ThomasPinella/junto`, branch `main`.
- Railpack used the committed `railway.toml`, `pnpm build`, `pnpm start`, dynamic `/health`, and the documented restart policy.
- Application variables are exactly the four documented public/runtime variables. No Supabase service-role or secret key is assigned to Railway.

## Supabase

- Project: `Junto Production` (`perssuedgyfxfvpupnge`).
- Region: `us-east-1`.
- Applied migration versions:
  - `20260718120000`
  - `20260718120100`
  - `20260718120200`
  - `20260719090000`
  - `20260719120000`
  - `20260719170000`
- No seed was applied.
- Auth site URL is the exact Railway production origin.
- Auth redirect allowlist contains the exact production `/auth/callback` URL.
- Email confirmations remain required.
- Anonymous sign-in remains disabled.
- The Postgres `before_user_created_hook` is enabled and rejects addresses without a pending, unexpired invitation before creating `auth.users`.
- Custom SMTP uses Resend from `junto@thomaspinella.com`; the application does not receive the Resend credential.
- Production email rate limit is 30 per hour.

## Intentional bootstrap

A one-time operational bootstrap created:

- one active, public-archive `philadelphia` Junto; and
- one pending admin invitation for the operator.

No general seed, fixture, real member record, credential, or privileged bootstrap path was committed. The invitation becomes durable authorization only after the operator verifies mailbox ownership and the callback claims it.

## Hosted verification

Passed against the production systems:

- Railway deployment reached `SUCCESS` and the service is online in US East.
- Railway service domain is active.
- `/health`, `/about`, `/`, `/meetings`, and `/essays` returned 200.
- `/health` returned only `{"status":"ready"}` with `no-store` caching.
- The public home/archive rendered the hosted Philadelphia Junto state.
- Anonymous `/portal` access redirected to the sign-in route.
- All six local migration versions matched the remote migration history.
- Anonymous reads could access the public essay projection but not private essay, membership, or invitation rows.
- An uninvited random address was rejected by the hosted signup hook and no Auth user was created.
- The invited operator address was accepted for a real email request; before confirmation, profile and membership rows remained absent.
- A non-team Gmail alias with a temporary pending invitation was accepted after Resend SMTP configuration, proving the default Supabase team-only mail restriction was no longer in force.
- The temporary SMTP test Auth user and invitation were removed in independent cleanup phases and verified absent.
- A fresh real operator sign-in email was accepted through Resend SMTP.
- Junto has no local Supabase containers, application servers, browsers, or relevant listeners left running. The separate Hazel development stack was identified by its own Docker project label and left untouched.
- The local `main` branch and `origin/main` matched and the worktree was clean before this deployment record.

## Operator action and residual operations

- The operator must click the delivered one-time email link to confirm the mailbox and claim the pending admin invitation. This is the intended first-use flow, not a privileged deployment step.
- Rotate the initial Resend API credential because it was shared through chat before configuration; rotation does not require an application redeploy, only an SMTP credential update in Supabase.
- Add archive and sitemap pagination before public essay counts materially exceed approximately 100.
- `/health` intentionally remains a process/environment check; public and Auth dependency checks stay separate as recorded above.
- Railway application rollback and database migration rollback remain separate concerns. Prefer reviewed forward migrations for database changes.
