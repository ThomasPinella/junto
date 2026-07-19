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
pnpm install
cp .env.example .env.local   # then fill in real values
pnpm db:start                # local Supabase stack (requires Docker)
pnpm dev
```

Missing or invalid environment variables fail explicitly at startup/build
with the offending variable named; see `.env.example` for the full list.

## Scripts

| Command             | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `pnpm format:check` | Prettier check (`pnpm format` writes)              |
| `pnpm lint`         | ESLint                                             |
| `pnpm typecheck`    | Strict TypeScript, no emit                         |
| `pnpm test`         | Unit/integration tests (Vitest)                    |
| `pnpm test:db`      | Database tests: pgTAP + live local Auth regression |
| `pnpm test:e2e`     | Playwright E2E (builds and serves the app itself)  |
| `pnpm build`        | Production build                                   |

`test:db` and `db:start` need Docker for the local Supabase stack. This host's
Docker daemon publishes unspecified ports to `127.0.0.1` by default, so the
development database and dashboards are not exposed on the VPS's public
interfaces. Run `pnpm db:stop` when finished.

`pnpm test:db` runs three stages: `test:db:pgtap` (pgTAP via
`supabase test db`), `test:db:safety` (deterministic self-checks of the live
harness's safety guarantees; needs no stack), and `test:db:auth` (a live Auth
regression that drives the running local GoTrue, PostgREST, and Mailpit
end to end). The live regression requires the local Supabase stack to be up
(`pnpm db:start`), seeds and tears down its own fixtures with the local
service-role key, and refuses to run against any non-loopback Supabase or
Mailpit endpoint — remote URLs in `SUPABASE_URL`/`MAILPIT_URL` are rejected
before any request is sent, with no override.

## Layout

- `src/app` — App Router routes: public publication shells and `/portal`
- `src/components` — shared presentational components
- `src/config` — routing and site configuration seams
- `src/lib` — server utilities (environment validation)
- `tests/unit`, `e2e`, `supabase/tests` — Vitest, Playwright, and pgTAP tests

Canonical routing: chapter pages live under `/juntos/[juntoSlug]`, essay pages
under `/essays/[essaySlug]`; `/` serves the chapter configured by
`JUNTO_INITIAL_JUNTO_SLUG` (see `src/config/routes.ts`).
