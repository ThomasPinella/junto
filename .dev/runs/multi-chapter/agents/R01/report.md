# R01 reconciliation — T01 secure chapter creation and administration

- Range: `a16b63504c66445b57ad11a296e0a3baffbd6efa..66ae231d453e495f01ebd7c60bd375072c68f245`
- Verdict: **Needs bounded fixes before integration**

## Evidence inspected

Read-only review of the repository/run rules, source map, all T01 governing docs, Builder report, complete diff, surrounding schema/RLS helpers, portal routing/actions, unit/pgTAP/live tests, fixture cleanup, and production route manifest. Accepted the orchestrator-verified format/lint/typecheck/unit/build/database/live evidence and excluded the invalid broad `pnpm test:e2e` attempt.

## Findings

### 1. Medium — `sign-in` is accepted as a chapter slug but conflicts with `/portal/sign-in`

The server parser and authoritative RPC accept `sign-in`, while `portalJunto("sign-in")` resolves to the static sign-in page. Creation succeeds and persists a first-admin membership, but every chapter home/switch link opens the sign-in route. With slug editing and deletion intentionally absent, that creates durable unusable routing state.

This bears on stable URLs, immediate chapter switching, and successful reuse of the new membership. It fits the approved scope and additive shape.

**Smallest correction:** reject `sign-in` in both the server parser and RPC; keep the database check after authorization; add focused unit/pgTAP coverage; document the reservation.

### 2. Low — authorization-before-validation is implemented but not regression-proven

The RPC authorizes before validation, but ordinary/inactive denial tests use only valid unique slugs. Duplicate-slug behavior is tested only as an eligible admin. Moving uniqueness or malformed-input checks before authorization would therefore not fail the suite.

This bears on private identifier non-disclosure and fits the approved scope.

**Smallest correction:** assert that ordinary and inactive callers receive the same `42501` for an existing private slug and malformed/null metadata, with no row changes.

## Evidence limitations

- The pgTAP row-survival assertion labels rows “pre-existing,” but inserts them after all migrations have run; it does not itself prove upgrade compatibility. Static inspection confirms the migration is forward-only, additive, `NOT VALID`, and performs no row rewrite.
- The live suite proves member RPC denial and selected/cross-chapter Admin isolation, but does not directly exercise ordinary or inactive users against `/portal/chapters/new`.
- The broad port-3210 stack-free attempt provides no T01 evidence.

## Clean areas

Definer/search-path/grants, atomic rollback, immediate membership visibility, selected-chapter RLS scoping, form normalization/defaults, invitation-backed global accounts, fixture cleanup, and the five owned docs reconcile cleanly.

## Recommendation

Do not integrate until both bounded corrections are implemented, rerun, and re-reviewed. No product-scope escalation is required.
