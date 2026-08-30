# 7. Public archive

The public archive should be attractive enough that authors feel proud sharing it.

## Homepage

The public homepage is the Junto network overview. It shows:

- a directory of every active public chapter;
- recent public essays across those chapters, each attributed and linked to
  its chapter;
- an optional featured chapter, meeting, or essay from the configured initial
  chapter;
- brief explanation of the Junto practice.

Each active public chapter has a canonical home at `/juntos/[juntoSlug]` with
its public description, meeting-led context, recent eligible public essays,
and links into its proceedings. Private, inactive, missing, and malformed
chapter routes use one metadata-safe not-found outcome.

## Essay archive

Visitors can browse public essays by:

- most recent;
- author;
- meeting;
- potentially topic or tag later.

The essay, meeting, and author indexes are network-wide. Chapter context must
remain visible wherever records from multiple chapters could otherwise be
ambiguous. Essay and author URLs remain globally stable; meeting URLs remain
scoped under their chapter.

## Essay reading page

A public essay page should display:

Essay title
Optional subtitle
Author name
Meeting date and meeting title
Estimated reading time
Essay body
Discussion
About the author
More from this author
Other essays from this meeting

The reading experience should avoid unnecessary sidebars, dashboards, and application chrome.

## Author page

A public author page includes:

- display name;
- optional profile photo;
- optional short biography;
- public essays;
- meetings in which the author published public essays.

A member’s private essays must not affect public counts or previews.

## Meeting page

A public meeting page includes:

- meeting date;
- title or theme;
- public description;
- public essays from the meeting;
- authors who published publicly.

Members-only essays must not be revealed or counted publicly.
