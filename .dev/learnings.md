# Dev learnings

Add only verified, non-obvious knowledge likely to prevent repeated mistakes across runs.

- This host has Docker Engine and a complete Supabase CLI installation in `~/.local/bin`. Docker's daemon defaults both the built-in bridge and newly created bridge networks to publish unspecified ports on `127.0.0.1`, so ordinary `supabase start` is loopback-only.
- Supabase Auth with `auth.email.enable_confirmations = false` implicitly confirms password signups. Any invitation claim that trusts `auth.users.email_confirmed_at` must require confirmations (or eliminate every autoconfirm path) and include a real GoTrue signup-to-claim regression before mailbox verification; direct SQL fixtures are insufficient proof.
- Privileged local-only integration harnesses must parse and reject non-loopback targets before the first request, enforce the same boundary at the lowest request layer, refuse automatic redirects, validate successful response schemas rather than only statuses, run checked cleanup from `finally`, catch failures at the smallest already-enumerated fixture unit so one thrown request cannot skip later identities, and run/aggregate absence verification even when cleanup fails. Network-free proofs should reject unexpected method/path combinations and assert the complete normalized request trace; “all observed calls were guarded” does not prove all required calls occurred.
- Supabase JS retries failed PostgREST `GET`/`HEAD` requests with 1s/2s/4s backoff. Public SSR reads should use a request-wide abort signal or explicitly disable retries, and stack-free tests should verify bounded outage rendering.
- Database confirmation flags exposed through PostgREST must treat only literal boolean `TRUE` as confirmation. SQL three-valued logic makes `NOT nullable_flag` fail open inside PL/pgSQL `IF`; test omitted, `false`, and explicit JSON `null` through the real API.

- When content and visibility require separate mutations, ordering is a privacy boundary: withdraw public visibility before writing newly private content, expose publicly only after content persistence succeeds, and report safe partial outcomes truthfully.

- When a typed Next.js route belongs to a later task, present its canonical URL as non-linked text until that route exists. Adding a typed `Link` prematurely can make the production build enforce future-task implementation and blur scope boundaries.

- Parameterized public detail routes must enforce the configured publication scope independently; projection-level public eligibility does not establish that a record belongs to the publication currently being served.

- For mobile target-size regressions, assert the rendered bounding box of the actual shared anchor under a real mobile device profile. CSS declarations and font line height alone do not prove an accessible hit area.

- A detached wrapper's exit does not establish process-tree exit: retain the original POSIX process-group ID and apply bounded TERM/KILL to the group independently of direct-child state.

- Exhaustive phase orchestration is truthful only when independent work inside each phase also settles exhaustively before that phase rejects.

- Deployment-readiness URL validation should constrain protocols to HTTP(S) while still permitting loopback HTTP for local verification; syntactic absolute-URL validity alone is insufficient.

- A clean-archive proof should assert that its working directory is inside the extracted candidate before the first install or build; creating an archive alone does not prove subsequent commands ran against it.

- A teardown correction is cumulatively complete only after every live spec is enumerated and every teardown owner is shown to use the shared exhaustive phase boundary; reviewing only new journeys can leave older specs with the same cleanup-skipping defect.

- Strict parser safety fixtures must use production-valid identifiers, and parsed projections must retain every field consumed downstream. Otherwise mocks can force a lax validator or make assertions pass on `undefined`; genuine API responses remain the authority for omitted-versus-null field semantics.
