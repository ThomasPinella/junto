# R01 independent reconciliation

## Range

`357ff635e29b7190435a7d002bbd85d3e9ffecdc..42f4545`

## Verdict

Correction required: one blocking static-route collision. No other specification, security, documentation, test-evidence, or scope mismatch found.

## Finding

The new exact static route `/portal/applications` collides with the existing dynamic chapter home `/portal/[juntoSlug]`, but `applications` remains accepted by authenticated chapter creation and by application approval. Existing `sign-in` is reserved for the same reason.

Smallest complete correction within approved scope:

- reserve exact slug `applications` in shared chapter-creation parsing and application-approval parsing;
- enforce it authoritatively in the new additive migration for existing/future direct table writes;
- reject it at the application approval RPC boundary;
- prove no pre-existing conflicting row when the migration is applied;
- add focused unit and pgTAP proof for both creation paths, authorization-before-input behavior, direct table insert/update denial, and approval rollback leaving the application pending with no chapter or invitation.

Adjacent route check: `chapters` owns only `/portal/chapters/new` and does not collide with `/portal/[juntoSlug]`; `sign-in` and `applications` are the only exact first-segment chapter-home collisions in the present route tree.

## Confirmed aligned

- Anonymous callers have only bounded submit capability and no read/list path.
- Exact verified reviewer authorization precedes private input/existence/slug probing at server and database boundaries.
- Approval is row-locked and transactional; duplicate/collision/invitation-failure behavior is rollback-safe.
- Approval creates an invitation, not an Auth user or membership; verified mailbox claim remains authoritative.
- Hardcoded reviewer/sender addresses and server-only `RESEND_API_KEY` match the approved plan.
- Post-transaction email failures are represented honestly and hosted delivery is not overclaimed.
- The 39-file fan-out is direct route/migration/documentation/fixture/evidence coverage, not an added framework or unrelated architecture.
