# 10. Member portal

The member portal should remain simple and focused.

## Portal navigation

Home
Meetings
Essays
Chat
Members
Profile

Admins additionally see:

Admin

Eligible administrators also have a persistent **Create chapter** entry. The
creation form asks for name, stable slug, optional description and location,
and archive visibility, with **Junto members only** selected by default. On
success the new chapter becomes the selected context and opens its Admin area,
where the creator can immediately invite approved member or administrator email
addresses through the existing mailbox-verified invitation flow.

The selected chapter's Admin area includes bounded chapter settings for name,
description, location, and archive visibility. It does not expose chapter
status, deletion, or ownership transfer. Switching chapters rechecks the live
membership and role for the newly selected Junto; private chapter names are not
shown before authentication or outside authorized active memberships.

`/portal/applications` is a separate reviewer-only surface inside the standard
portal frame. It lists private application details only for the exact verified
reviewer `txpinella@gmail.com`. Approval allows the reviewer to confirm or edit
the derived stable slug; approval and decline are explicit POST actions, not
email-link decisions. The page distinguishes a durable decision from a later
notification-delivery failure.

## Portal home

The home view can show:

- next meeting;
- essay deadline;
- essays submitted for the next meeting;
- recent comments on the member’s essays;
- recent chat activity;
- button to write an essay.

## Essay dashboard

Members can see:

- drafts;
- published essays;
- meeting association;
- visibility;
- last edited time;
- public URL where applicable.

Useful actions:

Write essay
Edit
Preview
Publish
Change visibility
View discussion

## Meeting view

The authenticated meeting view includes:

- all public and members-only published essays for that meeting;
- submission status by member, if desired;
- meeting details;
- optional recording;
- links into essay discussions.

## Members page

The members page can show:

- active members;
- display names;
- profile photos;
- short bios;
- role within the Junto.

Email addresses should not be displayed to other members by default.
