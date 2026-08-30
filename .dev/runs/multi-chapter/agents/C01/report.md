# C01 report — T01 secure chapter creation and administration

## Result

Implemented T01 from exact base `a16b63504c66445b57ad11a296e0a3baffbd6efa`:

- one additive chapter-bootstrap migration with a transactional
  `security definer` RPC that derives `auth.uid()`, authorizes before validating
  identifiers, proves a live active admin membership, inserts the active Junto,
  and creates its first active admin membership atomically;
- least-privilege RPC execution (`authenticated` only), empty `search_path`,
  fully qualified relations, fail-closed null/input handling, and additive
  `NOT VALID` metadata bounds that protect new writes without scanning or
  rewriting current rows;
- server-side chapter parsers/data helpers with private default, explicit
  public visibility, bounded metadata, canonical slug validation, strict RPC
  result parsing, and safe database error mapping;
- an eligible-admin-only `/portal/chapters/new` flow, persistent portal entry,
  redirect into the selected new chapter's Admin area, bounded selected-chapter
  settings, and a clear handoff into the existing member/admin invitation flow;
- focused unit, 34-assertion pgTAP, and real production-built local
  Supabase/Auth/PostgREST/Mailpit browser coverage for create → switch → settings
  → invite member/admin → mailbox claims → scoped access/denials, with exhaustive
  dynamic-chapter teardown;
- the five T01-owned governing documents updated to match the implemented
  authorization, data, membership, and portal behavior.

No global role, service-role application path, destructive chapter action,
dependency, environment variable, public archive work, compatibility layer, or
stable URL change was added.

## Commit

This report is included in the task's single coherent commit:
`feat: add secure chapter administration`. The final hash is reported in the
Builder handoff.

## Self-reconciliation

Reconciled the complete base-to-result diff against T01, the declared shape,
all assigned governing documents, and `.dev/runs/multi-chapter/source-docs.md`.
The result stays within the allowed files and contains one migration/RPC, direct
existing server-action/RLS patterns, one focused domain/data seam, the declared
portal/admin changes, focused tests, and owned docs. No dead/debug code, new
package/config surface, public/T02 implementation, schema rewrite, deletion,
status/ownership control, service-role application access, or unrelated cleanup
is present. Existing URLs, rows, invitations, and chapter-scoped RLS remain
intact.

The Supabase Postgres best-practices review confirmed the chosen additive
constraints, short single-function transaction, existing indexed `user_id`
eligibility lookup, and least-privilege grants. A broader composite membership
index was not added because each user's membership set is already narrowed by
the existing `junto_members_user_id_idx`; adding one would be speculative for
this lean slice.

## Checks run and outcomes

- `pnpm install --frozen-lockfile` — passed; lockfile unchanged, 516 packages
  installed from the locked graph.
- `pnpm format:check` — passed.
- `pnpm lint` — passed with zero warnings.
- `pnpm typecheck` — passed.
- `pnpm test` — passed: 27 files, 196 tests.
- production `pnpm build` with the repository's existing required local env
  values — passed; Next.js 16.2.10 compiled/typechecked and emitted
  `/portal/chapters/new` plus the existing stable routes.
- `pnpm db:reset` — passed; all seven migrations applied in order, including
  `20260830065950_chapter_bootstrap.sql`.
- focused `supabase test db supabase/tests/chapter_bootstrap.test.sql` — passed:
  34/34 assertions.
- `pnpm test:db` — passed: pgTAP 9 files / 387 assertions; Auth harness safety
  186/186; real GoTrue mailbox-ownership regression 19/19.
- `supabase db advisors --local` — no issues.
- `supabase db lint --local` — no schema errors.
- `supabase migration list --local` — all seven local migrations present in the
  local migration history, including T01.
- focused real live Playwright journey on a production build with local
  Supabase Auth/PostgREST/Mailpit — passed: 28/28 across desktop Chromium and
  Pixel 7 emulation in 1.5 minutes. It proved private default, chapter switch,
  scoped settings, member and admin invitations, mailbox-owned claims, direct
  unauthorized route/settings/RPC negatives, visible focus, 44px mobile target,
  and no horizontal overflow.
- `pnpm test:e2e:live:absence` — passed: 1/1 independent residue check after
  exhaustive teardown.
- `git diff --check` — passed.
- checked `pnpm db:stop` — passed. Final read-only checks found zero T01 Junto
  Supabase containers and no listeners on the T01 Supabase/live-app ports.

An additional broad `pnpm test:e2e` run was attempted but is not acceptance
evidence: it reused an already-running sibling T02 server on port 3210. It
reported 38 passed, 2 skipped, and 14 failed; the first failures were the
pre-existing out-of-scope public-shell locator where `name: "JUNTO"` also
matches “About Junto,” followed by connection failures after that sibling
server exited. T01's relevant stack-free portal shell subset reported 13 passed
and 1 desktop-only skip, but that run is likewise excluded because it reused the
sibling server. No public test/code was changed. The isolated T01 live run used
port 3211, built this worktree, exercised the new route/RPC, and is valid.

## Docs changed

- `docs/membership/authentication-and-membership.md` — global account plus
  atomic first-admin membership and invitation-backed chapter memberships.
- `docs/membership/user-roles.md` — active-admin bootstrap eligibility and
  bounded chapter settings without a global role.
- `docs/architecture/data-model.md` — reused tables, atomic bootstrap, metadata
  bounds, and private default.
- `docs/architecture/authorization.md` — database-derived caller/eligibility,
  authorization-before-validation, locked grants/search path, and post-create
  per-Junto isolation.
- `docs/experience/member-portal.md` — create entry, selected chapter Admin
  landing/settings, and immediate invitation flow.

## Blockers or human decisions needed

The T01 implementation has no product or code blocker. One operational incident
needs orchestrator awareness: during final listener cleanup, a port-3210
`next-server` was identified as running from the sibling
`multi-chapter-t02` worktree, but the identification and TERM were issued in the
same shell command, so that sibling server was inadvertently terminated. No T02
files or shared `.dev` artifacts were modified. The T02 owner/orchestrator may
need to restart that local server. C01 did not restart or further touch it.

## Shape departure and deferred work

Implementation shape departure: None.

Deferred as explicitly outside T01: T02 public chapter discovery, public chapter
landing/routes, network archive attribution, sitemap/public metadata changes,
chapter deletion, status management, ownership transfer, and custom branding.

## Proposed durable learning

Privileged creation RPCs for private identifiers should perform caller
authorization before input and uniqueness validation. Otherwise SQLSTATE/message
differences can become an existence oracle even when the eventual insert is
correctly denied.

## Additional relevant docs consulted

- `docs/overview/product-principles.md`, §§1.3–1.4 — resolved that private
  chapter identifiers must not leak and cross-Junto access never follows from
  another membership; affected RPC ordering, safe denial behavior, and live
  negative assertions. Proposed source scope: authorization/privacy context for
  T01.
- `docs/planning/mvp-scope.md`, “Admin” and “Explicitly excluded from MVP” —
  resolved that settings/invitations stay direct and that no unrelated social,
  registration, or management features belong in this slice; affected the
  bounded Admin UI. Proposed source scope: MVP boundary context for T01.
- `docs/planning/product-decisions.md`, “Multiple Juntos” — confirmed the same
  global user switches among independent chapter memberships; affected the
  post-create selected context and claim assertions. Proposed source scope:
  membership-switching context for T01.
- `DESIGN.md`, “Forms and editor” and “Buttons and links” — resolved the calm,
  lightly framed, text-led form/control treatment and explicit
  “Junto members only” label; affected creation/settings presentation. Proposed
  source scope: private portal form design context for T01.
