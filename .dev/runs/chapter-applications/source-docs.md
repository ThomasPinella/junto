# Source documentation scope

## `docs/architecture/data-model.md`

- Implementing: private chapter-application state, decision evidence, and atomic approved-chapter/admin-invitation creation.
- Not implementing: a general workflow, global-role, ownership, or audit subsystem.

## `docs/architecture/authorization.md`

- Implementing: anonymous submit-only boundary and exact verified-email reviewer authorization at server and database layers.
- Not implementing: service-role application access, configurable staff roles, or public application reads.

## `docs/membership/authentication-and-membership.md`

- Implementing: approved applicants enter the existing invitation-gated, verified-email claim lifecycle as chapter admins.
- Not implementing: bypassing mailbox ownership, duplicate per-chapter Auth accounts, or public registration.

## `docs/membership/juntos.md`

- Implementing: application approval as a second bounded path for creating a private active chapter with an initial pending admin invitation.
- Not implementing: chapter deletion, transfer, branding, or public-by-default archives.

## `docs/experience/member-portal.md`

- Implementing: one reviewer-only pending/decided application surface inside the standard portal shell.
- Not implementing: a generic operations dashboard, bulk decisions, reminders, or application messaging.

## `docs/design/surface-guidelines.md`

- Implementing: accessible editorial public form and restrained portal review rows/actions using existing surface patterns.
- Not implementing: a component-system rewrite or decorative application funnel.

## `DESIGN.md`

- Implementing: publication-like public intake and focused writing-room portal posture.
- Not implementing: unrelated visual or navigation redesign.

## `.env.example`

- Implementing: one server-only Resend credential placeholder and accurate complete-environment guidance.
- Not implementing: service-role or browser-exposed secrets.

## `README.md`

- Implementing: production Resend prerequisite and deployment verification for chapter applications.
- Not implementing: broader infrastructure migration or email-provider abstraction.
