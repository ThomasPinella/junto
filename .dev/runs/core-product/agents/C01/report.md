# C01 report — T01 Application and verification foundation

## Result summary

T01 is complete. The worktree now contains a strict-TypeScript Next.js 16
(App Router, Turbopack) application managed solely by pnpm, with Supabase
local-development configuration, explicit zod-based environment validation,
the approved Newsreader + Instrument Sans civic-journal design system
(warm-paper canvas, oxblood accent, editorial rules, visible keyboard focus,
reduced-motion support, ≥44px mobile targets), real public publication shells
(`/`, `/essays`, `/meetings`, `/authors`, `/about`), a member-portal shell
(`/portal`, noindexed, explicit "Junto members only" language), and honest
scripts for format, lint, typecheck, unit tests, pgTAP database tests,
Playwright E2E, and production build. Canonical routing seams are preserved
in `src/config/routes.ts` (`/juntos/[juntoSlug]`, `/essays/[essaySlug]`) and
`/` serves the chapter configured by `JUNTO_INITIAL_JUNTO_SLUG`. No T02+
schema, auth, or data behavior was implemented; shells carry honest
empty-state copy rather than fabricated product data.

## Commit

- Exact commit SHA: `db9c1c8714b1410fafc79935e9b04e15034f46af`
  (single commit on `dev/core-product-t01`, base `51d39dc9`)
- This report and `status.md` are intentionally left as uncommitted worktree
  artifacts so the report can cite the exact SHA without amending or adding a
  second commit.

## Files/surfaces delivered

- Tooling: `package.json` (pnpm-only, `packageManager` pinned, honest
  scripts), `pnpm-lock.yaml`, `tsconfig.json` (strict +
  `noUncheckedIndexedAccess`), `next.config.ts` (typedRoutes),
  `eslint.config.mjs` (eslint-config-next flat), `.prettierrc.json`,
  `.prettierignore`, `vitest.config.ts`, `playwright.config.ts`,
  `.gitignore`, `.env.example` (placeholders only), `README.md` (new).
- App: `src/app` root layout with next/font Newsreader + Instrument Sans;
  `tokens.css` (DESIGN.md tokens) and `globals.css` (focus-visible ring,
  skip link, reduced-motion); `(public)` layout + five publication shells;
  `portal` layout + home shell; editorial `not-found`.
- Modules: `src/lib/env.ts` (server-only zod validation, explicit
  `EnvValidationError`), `src/config/routes.ts` (canonical route seams),
  `src/config/site.ts` (initial-chapter configuration seam),
  `src/components/site-header|site-footer`.
- Supabase: `supabase/config.toml` (project_id `junto`, auth URLs pointed at
  the app), `supabase/tests/foundation.test.sql` (pgTAP smoke test; no domain
  schema).
- Tests: `tests/unit/*` (env, routes, site config, header), `e2e/*`
  (public + portal shells, desktop and mobile Chromium).

## TDD evidence (representative RED runs observed before implementation)

1. Env validation: `pnpm test` failed with `Failed to resolve import
   "@/lib/env"` before `src/lib/env.ts` existed → implemented → 9 tests green.
2. Route seams: `Failed to resolve import "@/config/routes"` → implemented →
   green.
3. Header/site config: `Failed to resolve import "@/components/site-header"`
   and `"@/config/site"` → implemented → green (17 unit tests total).
4. E2E: with specs written but no pages, `pnpm test:e2e` failed (web server
   readiness timeout because `/` returned 404 from a page-less app; direct
   `pnpm build` at that point emitted only the framework 404 route). After
   implementing the shells, one strict-mode locator ambiguity was fixed in the
   spec ("Philadelphia" appears in masthead and homepage label), then
   39 passed / 1 intentionally skipped (desktop skip of the mobile-only
   touch-target check).

## Checks run and actual outcomes

1. Clean dependency installation from committed lockfile:
   `rm -rf node_modules && pnpm install --frozen-lockfile` → success ("Done in
   6.9s"), suites re-ran green afterwards. ✅
2. Formatting: `pnpm format:check` → "All matched files use Prettier code
   style!" ✅
3. Lint: `pnpm lint` → clean (one interim unused-var warning in a test was
   fixed, not suppressed). ✅
4. Strict typecheck: `pnpm typecheck` → clean. ✅
5. Unit tests: `pnpm test` → 4 files, 17 tests passed (env validation,
   routes, site config, header navigation). ✅
6. Database tests: `pnpm test:db` (`supabase test db`, pgTAP foundation smoke
   test) → runs the real command; in this environment it fails explicitly
   with `LegacyDbConnectError: failed to connect to postgres` because Docker
   is not installed on this machine, so the local Supabase stack cannot
   start. The command is honest (no pass-through placeholder); it will pass
   where Docker is available. ⚠️ environment-limited, failure is explicit
7. Playwright E2E: `pnpm test:e2e` (production build + `next start`, desktop
   Chromium + Pixel 7 mobile) → 39 passed, 1 skipped (mobile-only
   touch-target check skipped on desktop project by design). Covers masthead,
   navigation to every shell, skip link, visible keyboard focus (computed
   outline assertions), warm-paper canvas color, no horizontal overflow on
   all six routes, ≥44px mobile nav targets, `prefers-reduced-motion`,
   portal members-only language and portal nav. ✅
8. Production build: `pnpm build` → success; 7 static routes. ✅
9. Explicit environment failure (proof requirement): `pnpm build` with
   `.env.local` removed → build fails with
   `EnvValidationError: Invalid environment configuration:` naming
   `NEXT_PUBLIC_SITE_URL` and `JUNTO_INITIAL_JUNTO_SLUG` as required but
   missing and pointing at `.env.example`. `.env.local` restored afterwards. ✅
10. Visual review via production-server screenshots (desktop 1280px, mobile
    390px, portal): editorial posture confirmed — type-led, fine rules, no
    cards/dashboard styling, hierarchy preserved on mobile. ✅

## Documentation changed

None (README.md is new implementation documentation; no product/design
source documents were modified).

## Blockers or human decisions needed

None blocking T01. Environmental note for the orchestrator: this machine has
no Docker, so `pnpm db:start`/`pnpm test:db` cannot run the local Supabase
stack here. T02's database tests will need Docker (or an environment with the
stack available) to be verified.

## Proposed updates

- Task status: T01 → done; T02 unblocked.
- Durable learning candidate: "The core-product builder host has no Docker;
  `supabase start`/`supabase test db` fail with an explicit connect error.
  Plan database-test verification for an environment with Docker."
- Durable learning candidate: TypeScript 7.x is now `latest` on npm; the app
  pins `typescript@^5.9` for Next.js/eslint-config-next compatibility — do
  not bump to 7 casually.

## Additional relevant docs consulted

- `docs/README.md` — practice description (750–3,500-word essays, read
  aloud, ~30-minute discussion, optional shared meal). Decision: use this as
  the factual copy for the `/about` shell instead of inventing product copy.
  Implementation effect: `src/app/(public)/about/page.tsx` paragraphs.
  Affected tests: e2e `/about` shell coverage. Proposed source-scope
  addition: none needed — `docs/README.md` is already in the run's source
  list; T01's use is consistent with its scope entry.
