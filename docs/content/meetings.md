# 5. Meetings

Meetings organize essays around a particular gathering.

A meeting includes:

- junto_id;
- meeting date;
- optional title;
- optional discussion theme;
- optional description;
- optional location;
- optional essay deadline;
- status such as upcoming, completed, or cancelled;
- creation and update timestamps.

Example:

June 22, 2026
Theme: What do we owe the future?
Location: Thomas’s apartment

## Meeting behavior

Members can associate an essay with a meeting.

A meeting page can display:

- the date;
- title or theme;
- description;
- essays submitted for that meeting;
- authors;
- optional meeting recording;
- comments or discussion associated with each essay.

A meeting should not be represented as a literal storage folder. It is a database entity that behaves like a folder in the interface.

Example URL:

/juntos/san-diego/meetings/2026-06-22

## Deleting meetings

Meetings should normally be archived rather than permanently deleted.

An administrator should not be able to accidentally destroy essays by deleting a meeting.

If a meeting is archived:

- its essays remain intact;
- its historical public page may remain available;
- it no longer appears among upcoming meetings.
