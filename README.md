# Junto

A public essay archive and private member portal for recurring, in-person,
essay-based discussion groups. See [AGENTS.md](AGENTS.md) and
[docs/README.md](docs/README.md) before changing code; the design source of
truth is [DESIGN.md](DESIGN.md).

## Stack

Next.js (App Router, strict TypeScript) + Supabase (Postgres, auth, RLS),
prepared for stateless hosting on Railway. `pnpm` is the only package manager.

## Setup

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local   # then fill in real values
pnpm db:start                # local Supabase stack (requires Docker)
pnpm db:reset                # migrations only; there is no committed seed
pnpm dev
```

Missing or invalid environment variables fail explicitly at startup/build
with the offending variable named; see `.env.example` for the full list.
The application requires exactly these four variables:

- `NEXT_PUBLIC_SITE_URL` — the absolute canonical application origin;
- `JUNTO_INITIAL_JUNTO_SLUG` — the active public chapter served at `/`;
- `NEXT_PUBLIC_SUPABASE_URL` — local or hosted Supabase project URL;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the project publishable/legacy anon key.

The application neither requires nor accepts a Supabase service-role/secret
key. That privileged key exists only inside loopback-guarded local fixture
harnesses and must never be configured on Railway.

## Scripts

| Command                      | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `pnpm format:check`          | Prettier check (`pnpm format` writes)              |
| `pnpm lint`                  | ESLint                                             |
| `pnpm typecheck`             | Strict TypeScript, no emit                         |
| `pnpm test`                  | Unit/integration tests (Vitest)                    |
| `pnpm test:db`               | Database tests: pgTAP + live local Auth regression |
| `pnpm test:e2e`              | Playwright E2E (builds and serves the app itself)  |
| `pnpm test:e2e:live`         | Live auth/portal journeys (needs `pnpm db:start`)  |
| `pnpm test:e2e:live:absence` | Independent fixture-absence check                  |
| `pnpm build`                 | Production build                                   |
| `pnpm verify:production`     | Start on supplied `PORT`, probe, and stop tree     |

`test:db` and `db:start` need Docker for the local Supabase stack. This host's
Docker daemon publishes unspecified ports to `127.0.0.1` by default, so the
development database and dashboards are not exposed on the VPS's public
interfaces. Run `pnpm db:stop` when finished.

`pnpm test:e2e` is stack-free: it proves the public shells and the
unauthenticated portal denials only. The authenticated member journeys —
invitation-gated magic-link sign-in through the real GoTrue/Mailpit email
flow, invitation claiming, multi-Junto switching, Junto-scoped admin
navigation, live deactivation, and sign-out — run through the explicit
integration command `pnpm test:e2e:live`, which requires the local Supabase
stack (`pnpm db:start`) and checks for it up front. Its privileged fixture
setup/teardown obeys the same loopback-only, fail-closed rules as the T02
Auth harness below.

`pnpm test:db` runs three stages: `test:db:pgtap` (pgTAP via
`supabase test db`), `test:db:safety` (deterministic self-checks of the live
harness's safety guarantees; needs no stack), and `test:db:auth` (a live Auth
regression that drives the running local GoTrue, PostgREST, and Mailpit
end to end). The live regression requires the local Supabase stack to be up
(`pnpm db:start`), seeds and tears down its own fixtures with the local
service-role key, and refuses to touch any non-loopback Supabase or Mailpit
endpoint: remote URLs in `SUPABASE_URL`/`MAILPIT_URL` are rejected up front,
every individual request revalidates its target immediately before it is
sent, and HTTP redirects are always refused — so a request can never be
forwarded off the loopback stack, with no override.

## Layout

- `src/app` — App Router routes: public publication shells, the public
  meeting archive (`/meetings` and the canonical
  `/juntos/[juntoSlug]/meetings/[meetingDate]` record pages, served from the
  safe `public_meetings` projection), the private member portal (`/portal`,
  `/portal/[juntoSlug]`, including the meeting program and Junto-scoped
  meeting administration), and the Supabase Auth callback (`/auth/callback`)
- `src/proxy.ts` — refreshes Supabase Auth cookies for private routes
  (never an authorization decision; protected server code re-checks the
  user and live active membership through RLS on every request)
- `src/components` — shared presentational components
- `src/config` — routing and site configuration seams
- `src/lib` — server utilities (environment validation, Supabase server
  client, membership/profile reads, portal authorization)
- `tests/unit`, `e2e`, `e2e/live` — Vitest, baseline Playwright, and live
  Supabase-backed Playwright journeys
- `supabase/tests` — pgTAP database tests plus the Node-based live Auth
  regression harness and its safety self-checks

Canonical routing: chapter pages live under `/juntos/[juntoSlug]`, essay pages
under `/essays/[essaySlug]`; `/` serves the chapter configured by
`JUNTO_INITIAL_JUNTO_SLUG` (see `src/config/routes.ts`).

## Complete clean verification

The accepted local sequence is intentionally explicit. It starts from the
locked dependency graph and a clean database, and it never relies on a seed
file—none is committed. Each live Playwright story creates unique fixtures in
`beforeAll` and performs checked, independently verified cleanup in `afterAll`.

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check

pnpm db:start
pnpm db:reset
pnpm test:db:pgtap
pnpm test:db:safety
pnpm test:db:auth
pnpm test:e2e
pnpm test:e2e:live
pnpm test:e2e:live
pnpm test:e2e:live:absence

PORT=3212 \
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3212 \
JUNTO_INITIAL_JUNTO_SLUG=verification \
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.invalid \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-publishable-value \
pnpm verify:production

pnpm db:stop
```

`test:db:safety` is the network-free privileged-harness safety suite;
`test:db:auth` owns a genuine GoTrue → Mailpit → callback invitation regression.
`test:e2e` is the complete stack-free browser suite. `test:e2e:live` is the
complete real-boundary suite, including the integrated admin invitation →
mailbox-owned membership → admin meeting → author preview/save/publish →
anonymous archive/proceedings/reading → cross-Junto denial → live deactivation
loop. Running it twice proves reset/cleanup repeatability; the final absence
command makes fixture cleanup a separately failing assertion.

The production probe requires an already-built `.next` directory, refuses a
busy `PORT`, invokes the documented `pnpm start` command, checks the readiness
endpoint and quiet `/about` route, terminates the complete process group, and
fails if the listener remains. For the stronger no-hidden-state proof, run it
from an archive of the candidate commit with no `.env.local`:

```sh
candidate_dir="$(mktemp -d)"
git archive HEAD | tar -x -C "$candidate_dir"
(
  cd "$candidate_dir"
  test ! -e .env.local
  pnpm install --frozen-lockfile
  NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3212 \
  JUNTO_INITIAL_JUNTO_SLUG=verification \
  NEXT_PUBLIC_SUPABASE_URL=https://placeholder.invalid \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-publishable-value \
  pnpm build
  PORT=3212 \
  NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3212 \
  JUNTO_INITIAL_JUNTO_SLUG=verification \
  NEXT_PUBLIC_SUPABASE_URL=https://placeholder.invalid \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-publishable-value \
  pnpm verify:production
)
rm -rf -- "$candidate_dir"
```

The placeholder URL is intentionally never contacted by `/health` or `/about`.
A successful start proves that the artifact is stateless and correctly shaped;
it does **not** prove that a hosted Supabase project is reachable or migrated.
After verification, `pnpm db:stop` must succeed; the project should have no
containers (`docker ps -a --filter label=com.supabase.cli.project=junto -q`),
and ports `3210`, `3211`, `3212`, and the local Supabase ports should have no
project-owned listeners.

## Railway and hosted Supabase readiness

[`railway.toml`](railway.toml) uses Railway's current Railpack builder and fixes
the service commands to `pnpm build` and stateless `pnpm start`. Next.js reads
Railway's injected `PORT`; neither the config nor application hard-codes a host
port or configures a volume. Railway checks `/health` and restarts only failed
processes (up to ten attempts). The dynamic, non-cacheable health endpoint
returns only `{"status":"ready"}` after validating the four required variable
shapes. It makes no network call and exposes no configuration value.

Before a human-approved deployment:

1. Create or select the hosted Supabase project and apply the committed
   migrations in timestamp order with the official CLI workflow:
   `supabase link --project-ref <project-ref>`, inspect
   `supabase migration list`, then run `supabase db push`. Do not use
   `--include-seed`; Junto has no committed seed and production fixture seeding
   is forbidden.
2. In Supabase Auth URL Configuration, set the Site URL to the exact production
   `NEXT_PUBLIC_SITE_URL` and allow the exact
   `https://<production-domain>/auth/callback` redirect. Configure production
   SMTP and retain email confirmation plus the database signup hook; invitation
   claiming depends on verified mailbox ownership.
3. Configure the four application variables above on the Railway service. Do
   not add `SUPABASE_SERVICE_ROLE_KEY`, local Supabase URLs, Mailpit URLs, fixture
   variables, a volume, or a deployment-time seed/migration command.
4. Build and verify locally, then—only with explicit human approval—deploy.
   Confirm `/health` returns 200, then separately exercise a hosted anonymous
   read and an invited authentication flow to prove the hosted database/Auth
   boundary.

Rollback is two separate concerns. Railway can roll the application back to a
previous artifact, but an applied database migration is durable; prefer a
reviewed forward migration and never assume an app rollback reverses schema.
Before revoking a release, preserve public URLs where policy requires, disable
traffic or remove the Railway deployment variables, revoke pending invitations
and deactivate memberships as appropriate, and verify Auth redirect URLs do not
continue pointing at an abandoned origin. No destructive remote action is part
of this repository workflow.

Operational choices were checked against the current official
[Railway config-as-code reference](https://docs.railway.com/config-as-code/reference),
[Railpack documentation](https://docs.railway.com/builds/railpack),
[health-check documentation](https://docs.railway.com/deployments/healthchecks),
[restart policy](https://docs.railway.com/deployments/restart-policy),
[Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations),
and [Supabase Auth redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls).
