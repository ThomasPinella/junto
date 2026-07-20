# Production deployment

## Release identity

- Product/run commit merged to `main`: `b6d898d9cdea99fd73b9cae34370bd22bcec0078`.
- San Diego chapter-label release: `748f52d7379e999b70f296022566400370e62e54`.
- GitHub remote: `ThomasPinella/junto`, branch `main`.
- Deployment authorized and performed: 2026-07-20.

## Railway

- Project: `Junto` (`b3d20dca-6c81-40d1-8267-f158b6b04172`).
- Service: `web` (`3d9b4024-fd77-4550-95e3-f19e65bcdec6`).
- Environment: `production`.
- Canonical public origin: `https://juntoessays.com`.
- Railway fallback service origin: `https://web-production-7724e.up.railway.app`.
- The apex custom domain is active, its Railway DNS record is propagated, its TLS certificate is valid, and plain HTTP redirects to HTTPS.
- Region: US East, one stateless replica.
- Source: GitHub `ThomasPinella/junto`, branch `main`.
- Railpack used the committed `railway.toml`, `pnpm build`, `pnpm start`, dynamic `/health`, and the documented restart policy.
- Supabase account cutover deployment: `01fa4389-efdf-4ad0-9455-a82c94cee62a`.
- Application variables are exactly the four documented public/runtime variables. No Supabase service-role or secret key is assigned to Railway.

## Supabase

- Organization: `Pinella` (`fwaeiatlkrtxthngquxr`).
- Project: `Junto` (`kssglkszniahfcedtszu`).
- Region: `us-east-2`.
- Applied migration versions:
  - `20260718120000`
  - `20260718120100`
  - `20260718120200`
  - `20260719090000`
  - `20260719120000`
  - `20260719170000`
- No seed was applied.
- Auth site URL is the canonical HTTPS origin: `https://juntoessays.com`.
- Auth redirect allowlisting contains the exact HTTP and HTTPS base URLs and `/auth/callback` URLs. The application generates only the HTTPS callback.
- Email confirmations remain required.
- Anonymous sign-in remains disabled.
- The Postgres `before_user_created_hook` is enabled and rejects addresses without a pending, unexpired invitation before creating `auth.users`.
- Custom SMTP uses Resend from `junto@thomaspinella.com`; the application does not receive the Resend credential.
- Production email rate limit is 30 per hour.

## Intentional bootstrap

A one-time operational bootstrap created one active, public-archive Junto and one admin invitation for the operator. The operator completed mailbox verification, the callback claimed the invitation, and the resulting admin membership is active.

The chapter was subsequently renamed in place to `San Diego Chapter`, with slug `san-diego` and location `San Diego, CA`; its existing identity, invitation history, and membership relationships were preserved.

No general seed, fixture, real member record, credential, or privileged bootstrap path was committed.

## Hosted verification

Passed against the production systems:

- Railway deployment reached `SUCCESS` and the service is online in US East.
- Railway-generated and custom service domains are active.
- `juntoessays.com` DNS is propagated to Railway, Railway TLS is valid, HTTP redirects to canonical HTTPS, and the HTTPS origin serves Junto.
- `/health`, `/about`, `/`, `/meetings`, and `/essays` returned 200.
- `/health` returned only `{"status":"ready"}` with `no-store` caching.
- The public home/archive renders the hosted San Diego Chapter state.
- Anonymous `/portal` access redirects to the sign-in route.
- All six local migration versions matched the remote migration history.
- Anonymous reads could access the public essay projection but not private essay, membership, or invitation rows.
- An uninvited random address was rejected by the hosted signup hook and no Auth user was created.
- The invited operator address was accepted for a real email request; before confirmation, profile and membership rows remained absent.
- A non-team Gmail alias with a temporary pending invitation was accepted after Resend SMTP configuration, proving the default Supabase team-only mail restriction was no longer in force.
- The temporary SMTP test Auth user and invitation were removed in independent cleanup phases and verified absent.
- A fresh real operator sign-in email was accepted through Resend SMTP.
- On 2026-07-20, production was migrated from the original Supabase account into the dedicated `Junto` project in the `Pinella` organization. A protected local export recorded the old environment before cutover.
- The migration preserved the San Diego chapter ID, profile data, claimed-invitation ID/evidence, and active admin-membership ID. Supabase issued a new project-local Auth user ID, and all user references were remapped to it.
- Hosted acceptance on the new project passed public rendering, anonymous private-table denial, migrated-user magic-link verification, authenticated profile/admin-membership/invitation RLS, invitation-gate rejection, and non-team Resend acceptance.
- The disposable SMTP test Auth user and invitation were deleted with explicit approval and independently verified absent; final cardinalities exactly match the pre-migration inventory.
- The previous Supabase project remains intact and its connection details/export remain in protected local files for rollback; Railway no longer references it.
- Junto has no local Supabase containers, application servers, browsers, or relevant listeners left running. The separate Hazel development stack was identified by its own Docker project label and left untouched.
- The local `main` branch and `origin/main` matched and the worktree was clean before this deployment record.

## Residual operations

- Rotate the initial Resend API credential because it was shared through chat before configuration; rotation does not require an application redeploy, only an SMTP credential update in Supabase.
- Add archive and sitemap pagination before public essay counts materially exceed approximately 100.
- `/health` intentionally remains a process/environment check; public and Auth dependency checks stay separate as recorded above.
- Railway application rollback and database migration rollback remain separate concerns. Prefer reviewed forward migrations for database changes.
