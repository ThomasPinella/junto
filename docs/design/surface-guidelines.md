# Surface Design Guidelines

This document applies the [Junto visual system](../../DESIGN.md) to the public archive and private member portal.

The unifying idea is:

> The permanence of a publication and the intimacy of a table.

The public and private experiences should clearly belong to the same Junto, but they serve different purposes:

- **Public:** a living civic journal designed for exploration and sustained reading.
- **Private:** a focused writing room and chapter tool designed to support the next gathering.

## 1. Public homepage

The homepage is primarily an editorial exploration surface. It should reveal what Junto members are thinking about, who is writing, and how the essays emerge from real meetings.

### Recommended composition

1. All-caps **JUNTO** masthead, with the chapter or city in restrained small caps.
2. Quiet navigation: Archive, Meetings, Authors, About, Member Portal.
3. One dominant featured meeting or essay.
4. A composed list of essays connected to that meeting.
5. Recent essays grouped as editorial rows rather than cards.
6. Recent meetings or a meeting archive.
7. Participating authors.
8. A concise explanation of the Junto practice.

### Meeting-led feature

The primary feature should make meeting context visible:

```text
MEETING XXIV · JUNE 22, 2026

WHAT DO WE OWE THE FUTURE?

Four essays presented and discussed
```

This structure makes Junto distinct from a group blog. The meeting is not merely metadata; it records the moment in which the essays were read and considered together.

### Avoid

- A generic marketing hero and benefit-card sequence.
- A feed of interchangeable post cards.
- A cover image requirement for every essay.
- Large calls to “join the community” before explaining the practice.
- Abstract claims about connection, ideas, or belonging that could describe any community product.

## 2. Essay archive

The archive should support browsing by recent publication, author, and meeting. Topic or tag browsing may be introduced later without replacing meeting context.

### Essay row anatomy

Each listing should normally contain:

- essay title;
- optional subtitle;
- author;
- meeting title or theme;
- meeting date;
- estimated reading time.

Use typographic contrast, alignment, whitespace, and fine rules to separate entries. Cards are appropriate only when they solve a real content or responsive problem.

### Density

The archive may be denser than the homepage, but it should remain publication-like. A visitor should be able to scan titles and authors without encountering dashboard filters, excessive badges, or metadata noise.

## 3. Public essay page

The essay page is a reading surface. Everything that does not aid reading, authorship, meeting context, or discussion should recede.

### Header hierarchy

1. Meeting context.
2. Essay title.
3. Optional subtitle.
4. Author.
5. Date and estimated reading time.

Meeting context should be visible but subordinate to the essay title. It should link to the public meeting page where appropriate.

### Reading column

- Target a `65–72ch` measure.
- Use approximately `19–21px` serif body text on desktop.
- Use a `1.65–1.75` line height.
- Keep sidebars and persistent application chrome out of the primary reading area.
- Design headings, block quotes, lists, links, horizontal rules, and code blocks as part of the reading system.
- Keep the public page comfortable on narrow screens; do not reduce the body text merely to preserve desktop density.

### Secondary material

After the essay, present these in a clear sequence:

1. About the author.
2. More from this author.
3. Other essays from the meeting.
4. Discussion by Junto members.

Do not allow related content to interrupt the essay body as recommendation widgets.

## 4. Meeting page

A meeting page is the record of a gathering. It should feel closer to an edition, program, or set of proceedings than a calendar event.

Recommended content order:

1. Date and meeting number if used.
2. Title or theme.
3. Public description.
4. Essays presented.
5. Authors.
6. Optional public recording.

Members-only essays must not be named, previewed, or included in public counts.

Real documentary photography may be used sparingly when available: a table, marked-up drafts, a room, or details from the chapter’s city. Avoid generic event photography and staged networking imagery.

## 5. Author page

Author pages should establish authorship without turning members into social profiles.

Include:

- display name;
- optional portrait;
- optional short biography;
- public essays;
- public meetings in which the author published.

Do not include follower counts, activity scores, reaction totals, or public traces of private essays. Portraits should not become an oversized professional-network grid.

## 6. Public discussion

Discussion extends the essay rather than functioning as a separate engagement surface.

Use:

- the heading **Discussion by Junto members**;
- full names rather than handles;
- one visible level of replies;
- restrained avatars, if any;
- readable comment measures;
- quiet timestamps;
- typographic indentation or fine rules rather than large nested cards.

Avoid likes, reactions, ranking, follower mechanics, and deeply nested Reddit-style threads.

A marginalia-inspired treatment may be explored on wide screens, but the underlying information structure should remain simple and work linearly on mobile.

## 7. Member portal

The member portal is primarily an operating surface, not a marketing page. It should help members prepare for and continue the chapter’s real-world practice.

### Portal navigation

Keep the specified navigation concise:

- Home
- Meetings
- Essays
- Chat
- Members
- Profile
- Admin, for authorized users

The all-caps **JUNTO** identity should remain visible, but the portal navigation can be denser and more functional than the public masthead.

### Portal home priority

1. Next meeting.
2. Essay deadline.
3. Submission state for the next meeting.
4. Write or continue essay.
5. Recent comments on the member’s essays.
6. Recent chapter chat.

Do not transform these into a row of analytics or KPI cards. A composed agenda, dated list, or meeting program is a better model.

Example structure:

```text
NEXT MEETING

Thursday, September 12 · 7:00 PM
What are we becoming incapable of noticing?

ESSAYS
Thomas Pinella       Submitted
Maya Chen            Draft
Daniel Ortiz         Awaiting essay
```

Submission state should be shown only where the product’s privacy rules permit it.

## 8. Essay dashboard and editor

### Essay dashboard

The essay dashboard may use a compact table or editorial list containing:

- title;
- meeting;
- publication status;
- visibility;
- last edited time;
- public URL where applicable.

Actions should be direct: Write essay, Edit, Preview, Publish, Change visibility, View discussion.

### Editor

The editor should feel calm and focused:

- title field;
- meeting selector;
- explicit visibility selector;
- Markdown editing area;
- rendered preview;
- quiet save state;
- clear draft or published state;
- deliberate publish action.

The rendered preview should use the same typography and content styles as the public essay page.

Publication status and visibility must remain visually distinct. Use the full visibility labels:

- **Public**
- **Junto members only**

Changing an essay from members-only to public should feel consequential and require explicit confirmation. Do not rely on color alone to communicate privacy.

## 9. Member meeting view

The authenticated meeting view may include public and members-only essays, submission status where appropriate, meeting details, recordings, and links into discussion.

Use an agenda or proceedings model:

- meeting details establish the moment;
- essays are the dominant objects;
- authorship is visible;
- visibility is explicit;
- discussion is attached to each essay.

Do not represent the meeting as a literal file folder or a generic calendar card.

## 10. Chat and members

### Chat

Chat should remain lightweight. Use the same warm palette and quiet typography, but optimize for legibility and continuity rather than reproducing the editorial essay layout.

Avoid gamification, presence theater, reaction clutter, and unnecessary channel infrastructure. Chat supports coordination and conversation between meetings; it is not the center of Junto.

### Members

The members page should feel like a chapter roster rather than a social graph. Use restrained portraits, names, short biographies, and roles. Email addresses remain private by default.

## 11. Imagery

Prefer real material from the practice:

- marked-up drafts;
- papers, books, glasses, and plates around a table;
- members reading or listening;
- the meeting room before or after a gathering;
- street and neighborhood details from the chapter’s city;
- occasional author portraits.

Photography should be observational and lightly art-directed. It should document that the practice exists in the world.

Avoid:

- generic philosophical stock imagery;
- staged professional-networking scenes;
- AI-generated conceptual illustrations as the default;
- decorative cover imagery forced onto every essay;
- imagery that exposes a private meeting location or member without consent.

## 12. Interaction and motion

Motion should clarify interaction rather than create spectacle.

- Use short, quiet transitions for hover, focus, expand, and publish states.
- Prefer underlines, color changes, and subtle movement over animated cards.
- Avoid scroll theater, looping decorative motion, parallax, and large page transitions.
- Respect `prefers-reduced-motion`.
- Maintain visible keyboard focus and at least `44px` mobile touch targets.

## 13. Responsive behavior

Mobile design should preserve the publication’s hierarchy:

- Keep the **JUNTO** masthead legible and confident.
- Collapse navigation deliberately rather than shrinking it into illegibility.
- Preserve comfortable essay body size and line height.
- Convert multi-column editorial compositions into ordered sequences.
- Keep meeting context attached to its essays.
- Render marginalia and threaded discussion linearly.
- Ensure publishing and visibility controls remain explicit and easy to operate.

## 14. Design review questions

Before accepting a new surface, ask:

1. Is the essay still the central object?
2. Is the meeting context visible where it adds meaning?
3. Does the public page feel like a publication rather than software?
4. Does the private page support the real gathering rather than manufacture online activity?
5. Is typography doing work that unnecessary cards, icons, or color would otherwise do?
6. Would an author feel proud sharing this page?
7. Does the design feel contemporary without losing warmth?
8. Have we introduced faux history, generic SaaS styling, or social engagement mechanics?
9. Are private content and visibility states unambiguous?
10. Does the surface remain coherent and readable on mobile?
