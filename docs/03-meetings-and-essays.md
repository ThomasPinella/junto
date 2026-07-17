# Meetings and Essays

Meetings provide the recurring structure; essays are the center of the product.

## 5. Meetings

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

### Meeting behavior

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

### Deleting meetings

Meetings should normally be archived rather than permanently deleted.

An administrator should not be able to accidentally destroy essays by deleting a meeting.

If a meeting is archived:

- its essays remain intact;
- its historical public page may remain available;
- it no longer appears among upcoming meetings.

## 6. Essays

An essay belongs to:

- one Junto;
- one author;
- normally one meeting.

An essay contains:

- title;
- stable slug;
- Markdown body;
- rendered HTML derived from Markdown;
- short optional subtitle or description;
- visibility;
- publication status;
- associated meeting;
- author;
- creation timestamp;
- update timestamp;
- publication timestamp;
- optional cover image;
- optional reading-time estimate.

### 6.1 Writing and editing

Members can write directly in the application or paste an essay into a Markdown editor.

The editor should include:

- title field;
- meeting selector;
- visibility selector;
- Markdown editing area;
- rendered preview;
- save draft;
- publish;
- clear indication of current publication status.

Basic Markdown support should include:

- headings;
- paragraphs;
- bold;
- italics;
- block quotes;
- links;
- ordered and unordered lists;
- horizontal rules;
- code blocks if easy to support.

The application should sanitize rendered HTML and prevent scripts or dangerous markup.

### 6.2 Meeting assignment

When creating an essay, a member selects the meeting it belongs to.

The meeting selector should show useful labels such as:

June 22, 2026 — What do we owe the future?
July 13, 2026 — Open topic

Members may submit an essay after the meeting date.

For the MVP, an essay should normally belong to exactly one meeting. The schema may allow a nullable meeting reference for future standalone essays, but the main product flow should encourage meeting assignment.

### 6.3 Publication status

Publication status and visibility are separate concepts.

status:
- draft
- published
visibility:
- public
- members_only

Valid examples include:

Draft + members only
Published + members only
Published + public

A draft must never appear in public or member-facing essay listings other than the author’s own dashboard and authorized administrative views.

### 6.4 Public essays

A published public essay:

- appears in the public archive;
- appears on the author’s public page;
- appears on the public meeting page;
- receives a public URL;
- may be indexed by search engines;
- may include public Open Graph metadata;
- may be shared without authentication.

Example:

/essays/what-we-owe-the-future

### 6.5 Members-only essays

A published members-only essay:

- is visible only to active members of the same Junto;
- appears in the authenticated meeting view;
- appears in the authenticated author view;
- must not appear on public archive pages;
- must not produce public metadata;
- must not be accessible merely by guessing its URL.

The interface should label this clearly as:

Junto members only

rather than simply:

Private

### 6.6 Changing visibility

An author or authorized administrator may change a published essay from public to members-only.

That change must take effect immediately.

After the change:

- the public URL must stop serving the essay;
- public listings must stop showing it;
- search metadata and sitemap entries must be removed during the next regeneration;
- logged-in members of the relevant Junto may continue to access it.

Changing an essay from members-only to public should require an explicit confirmation because it exposes the essay to the internet.

### 6.7 Stable URLs

Essay slugs should be unique within an appropriate scope.

Changing the essay title should not automatically break existing links.

The application should either:

- keep the original slug stable; or
- preserve redirects from prior slugs.

For the MVP, keeping the original slug stable is simplest.
