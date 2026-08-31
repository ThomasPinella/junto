# V01 independent review

## Range

`2f9aebe237445128a0fd58e72e1bcd4635d5b08a..4954e02`

## Verdict

FAIL — one qualifying privacy correction required.

## Finding

Anonymous submission distinguishes a fresh application from an already-pending normalized email. The unique pending-email index yields `23505`; the TypeScript layer maps this to `already-pending`; the page tells the caller that the email already has an application. The RPC also returns `application_id` and `stored`, so a direct anonymous caller sees a second discriminator even if the UI is changed.

- Qualification: violates the approved private-application, anonymous submit-only/no-read boundary and explicit exclusion of public application-status lookup. Anyone can probe whether an arbitrary email currently has a pending application.
- Severity: Medium.
- Smallest fix: make duplicate-pending and fresh submissions indistinguishable at both RPC and UI boundaries—no `23505`, `stored`, application ID, or other duplicate discriminator—and add regression coverage comparing anonymous outcomes for new and already-pending emails while preserving one pending row.

## Confirmed aligned

The `applications` route-collision correction is complete: both TypeScript creation paths reject it, the decision RPC rejects it after authorization, the validated constraint covers direct writes and pre-existing conflicts, nearby slugs remain valid, and rollback is tested.

The reviewer inspected the complete diff, governing documentation, adjacent bootstrap/invitation/Auth claim code, RLS/grants/security-definer functions, routes, Resend handling, environment readiness, and supplied unit/pgTAP/E2E/build evidence. No other qualifying finding or observation was reported.

A valid hosted Resend key, verified sender domain, and hosted delivery verification remain a production release blocker rather than a local-code failure.
