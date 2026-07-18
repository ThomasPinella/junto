# Junto Documentation

Junto is a public essay archive and private member portal for essay-based, in-person discussion groups.

The practice is inspired by Benjamin Franklin’s original Junto: members meet regularly to improve themselves and contribute to society through serious conversation about philosophy, politics, morality, personal experience, history, and other consequential topics. In the current format, each member writes a 750–3,500 word essay that takes a stance or makes a claim, reads it aloud at an in-person meeting, and discusses it with the group for roughly 30 minutes. Chapters may optionally share a meal before the readings.

The product preserves and extends that practice. It gives each chapter a private place to coordinate and discuss essays, while creating a polished public archive for essays authors choose to publish. The long-term possibility is a network of independent city chapters, with occasional gatherings across chapters, without weakening the intimacy and autonomy of each local group.

## Documentation map

The documentation is organized by feature area, one file per specification section. Section numbers (§) preserve the original specification’s global numbering.

### Overview

What Junto is, the underlying practice, and the product’s north stars. These documents define the practice Junto supports and the principles that should guide product decisions.

- [Vision and practice](./overview/vision-and-practice.md) — the Junto practice, product summary, and concise product definition (§19)
- [Product principles (§1)](./overview/product-principles.md)

### Users, membership, and Juntos

Roles, invitations, memberships, and multi-chapter behavior. These documents define who can use Junto, how chapter access is granted, and how independent Juntos remain isolated.

- [User roles (§2)](./membership/user-roles.md)
- [Authentication and membership (§3)](./membership/authentication-and-membership.md)
- [Juntos (§4)](./membership/juntos.md)

### Meetings and essays

The central content model and publishing workflow. Meetings provide the recurring structure; essays are the center of the product.

- [Meetings (§5)](./content/meetings.md)
- [Essays (§6)](./content/essays.md)

### Public archive and member experience

Public pages, portal navigation, and meeting recordings. These documents cover the editorial public experience, the focused private portal, and optional meeting recordings.

- [Public archive (§7)](./experience/public-archive.md)
- [Member portal (§10)](./experience/member-portal.md)
- [Optional meeting videos (§11)](./experience/meeting-videos.md)

### Comments and chat

Essay discussions and lightweight private chapter chat. Discussion stays attached to essays where possible; chapter chat remains deliberately lightweight.

- [Essay comments and discussion threads (§8)](./discussion/essay-comments.md)
- [Member chat (§9)](./discussion/member-chat.md)

### Data model and authorization

Suggested schema, Row Level Security, and isolation rules. The application is multi-Junto from the beginning. Authorization and data isolation are core architecture, not optional hardening.

- [Suggested data model (§12)](./architecture/data-model.md)
- [Authorization model (§13)](./architecture/authorization.md)

### Product decisions and MVP scope

Settled product rules, included scope, exclusions, and success criteria. These documents record recommended product rules, the MVP boundary, and the conditions for calling the MVP successful.

- [Important product decisions to document (§14)](./planning/product-decisions.md)
- [MVP scope (§15)](./planning/mvp-scope.md)
- [MVP success criteria (§20)](./planning/success-criteria.md)

### Implementation plan and testing

Build batches and critical end-to-end journeys. Build in vertical batches that prove authorization and cross-Junto isolation early, then verify the complete product through critical user journeys.

- [Recommended implementation batches (§16)](./implementation/implementation-batches.md)
- [Critical end-to-end journeys (§17)](./implementation/critical-journeys.md)

## Product center

The essay is the central object. Meetings organize essays in time, authors organize them by person, comments support discussion around them, and chat supports lightweight conversation between meetings. Junto should feel like a literary publication in public and a focused member tool in private—not a generic social network or community platform.
