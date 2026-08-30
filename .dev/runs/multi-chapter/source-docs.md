# Source document scope

## `docs/membership/juntos.md`

- Implementing: public chapter discovery/landing pages, chapter creation metadata, archive visibility, and independent chapter identity.
- Not implementing: cover images, custom per-chapter visual identities, or chapter deletion.

## `docs/membership/authentication-and-membership.md`

- Implementing: post-authentication chapter selection/switching and invitation-gated membership under newly created chapters.
- Not implementing: public signup, duplicate per-chapter auth accounts, or pre-login disclosure of private chapters.

## `docs/membership/user-roles.md`

- Implementing: chapter-scoped admin creation/settings/invitation authority and strict separation of member/admin rights per chapter.
- Not implementing: global super-admin, ordinary-member invitations, or ownership transfer.

## `docs/architecture/data-model.md`

- Implementing: atomic creation of an existing `juntos` row plus its creator's existing `junto_members` relationship; reuse of current schema.
- Not implementing: new tenancy tables, destructive schema changes, or rewriting existing records.

## `docs/architecture/authorization.md`

- Implementing: database-derived eligibility for chapter bootstrap, anonymous visibility of only active public chapters/content, and denied cross-chapter/private cases.
- Not implementing: service-role application access or UI-only authorization.

## `docs/experience/member-portal.md`

- Implementing: chapter creation entry, chapter switching, bounded chapter settings, and reuse of the selected chapter's invitation/admin surface.
- Not implementing: chat, analytics dashboards, or unrelated portal features.

## `docs/experience/public-archive.md`

- Implementing: network home, public chapter directory/home, public aggregate indexes, and chapter labels/links on public records.
- Not implementing: tags, recommendations, engagement feeds, or a pagination redesign.

## `docs/design/surface-guidelines.md`

- Implementing: publication-like chapter/network discovery and focused portal controls using current typography, hierarchy, responsive, and accessibility rules.
- Not implementing: visual rebrand, generic SaaS cards/dashboard patterns, or chapter-specific theming.

## `DESIGN.md`

- Implementing: existing tokens and civic-journal/editorial component posture on the new and changed surfaces.
- Not implementing: token changes or new design-system abstractions unless a small missing state is demonstrably required.
