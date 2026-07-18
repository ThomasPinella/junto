---
version: alpha
name: Junto — Contemporary Civic Journal
description: A living civic journal made around a table—intellectually serious, materially warm, quietly contemporary, and centered on authored thought rather than online activity.
colors:
  canvas: "#F3F0E8"
  surface: "#FBFAF6"
  primary: "#1C1C18"
  muted: "#66635B"
  rule: "#D5D0C5"
  accent: "#7A302B"
  accent-hover: "#642622"
  accent-contrast: "#FFFFFF"
  focus: "#9A3F38"
typography:
  masthead:
    fontFamily: Newsreader
    fontSize: 2.25rem
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  display:
    fontFamily: Newsreader
    fontSize: 4rem
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  h1:
    fontFamily: Newsreader
    fontSize: 3rem
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  h2:
    fontFamily: Newsreader
    fontSize: 2rem
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body-lg:
    fontFamily: Newsreader
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0em"
  body:
    fontFamily: Newsreader
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  ui:
    fontFamily: Instrument Sans
    fontSize: 1rem
    fontWeight: 450
    lineHeight: 1.4
    letterSpacing: "0em"
  label:
    fontFamily: Instrument Sans
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  none: 0px
  subtle: 2px
  control: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 96px
components:
  page-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: 24px
  metadata-label:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 4px
  editorial-rule:
    backgroundColor: "{colors.rule}"
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
    height: 1px
  focus-indicator:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.accent-contrast}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: 4px
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-contrast}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: 12px
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: 12px
  essay-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.none}"
    padding: 24px
---

## Overview

Junto should look like a **contemporary civic journal**: a serious independent publication produced through an intimate, recurring, in-person practice.

The core creative idea is:

> The permanence of a publication and the intimacy of a table.

The visual system should be:

- literary, but not precious;
- serious, but not stern;
- warm and intimate, but not lifestyle-oriented;
- historically conscious, but unmistakably contemporary;
- designed enough that authors are proud to share it, and quiet enough that the essays remain the point.

The primary visual reference is the first approved concept: the warm, meeting-led homepage with an all-caps `JUNTO` masthead. The wordmark should be presented as **JUNTO**, not title case, in primary masthead contexts. A chapter or city name may sit beneath or beside it in restrained small caps.

Junto is not visually a generic social network, community platform, event manager, publishing dashboard, or SaaS product. The public experience is a publication. The private experience is a focused writing room and chapter tool.

## Colors

The palette evokes paper, ink, conversation, and editorial notation without simulating an antique document.

- **Canvas (`#F3F0E8`)** — the primary warm-paper page background.
- **Surface (`#FBFAF6`)** — a quieter reading or working surface placed against the canvas when separation is needed.
- **Primary ink (`#1C1C18`)** — primary text and structural marks; softer and warmer than pure black.
- **Muted (`#66635B`)** — metadata and secondary text. Do not use for essential low-size text without checking contrast.
- **Rule (`#D5D0C5`)** — fine dividers and editorial structure.
- **Accent (`#7A302B`)** — a restrained oxblood used for interaction, selected states, and occasional editorial emphasis.
- **Accent hover (`#642622`)** — stronger interaction state.

The accent should be scarce. Most hierarchy should come from type, scale, spacing, alignment, and rules rather than color.

Dark mode is not part of the primary identity. It may be added later for reading comfort, but it should be derived from the same warm editorial posture rather than becoming a black, high-glow technology theme.

## Typography

Typography carries most of Junto’s identity.

### Recommended starting families

- **Newsreader** — masthead, essay titles, display headings, and long-form reading.
- **Instrument Sans** — navigation, controls, labels, dates, and application metadata.

These are implementation starting points, not an instruction to imitate another publication. If the final typefaces change, preserve their roles: a contemporary, highly readable editorial serif paired with a quiet humanist sans.

### Masthead

The primary masthead is the uppercase wordmark **JUNTO**. It should feel confident and editorial, not ornamental. Use generous tracking, a restrained weight, and enough surrounding space for it to function as the publication’s signature.

Do not add a crest, seal, quill, Franklin portrait, or faux-historical badge. A future monogram may abstract the idea of a table or gathering, but the wordmark should remain sufficient on its own.

### Essays

Long-form essay text should generally use:

- a `19–21px` desktop size;
- a `65–72ch` line length;
- a `1.65–1.75` line height;
- strong but restrained headings;
- clearly designed block quotes, lists, links, and horizontal rules;
- minimal competing interface chrome.

Paragraph rhythm should support sustained thought rather than make the essay look like a feed of fragments.

### Labels and metadata

Dates, meeting numbers, chapter names, reading times, and navigation may use uppercase or small-cap styling with restrained tracking. This creates historical and archival continuity without decorative nostalgia.

Avoid using monospace as a primary visual device. Junto is a literary and civic practice, not a technical system.

## Layout

Public surfaces should use an editorial grid, generous whitespace, fine rules, and deliberate asymmetry. Prefer composed lists and grouped text over repeating cards.

Meetings provide the archive’s editorial rhythm. A meeting date, number, or theme may act like the organizing structure of an edition, while still being called a meeting in product language.

Recommended layout principles:

- Let one idea or essay dominate each major composition.
- Use meeting context as a primary organizing element, not buried metadata.
- Keep public reading measures narrow and application chrome minimal.
- Allow the homepage and archive to be wider and more compositional than essay pages.
- Use thin rules to establish relationships before adding boxes.
- Preserve substantial empty space around the masthead and major editorial moments.
- On mobile, retain hierarchy and rhythm rather than merely stacking desktop cards.

The private portal may be denser, but it should still feel like a writing room or meeting agenda rather than a metrics dashboard.

## Elevation & Depth

Junto is primarily flat and typographic.

- Prefer background shifts, spacing, and rules over shadows.
- Avoid floating glass panels and stacked card elevation.
- If a transient overlay requires elevation, use one soft, low-contrast shadow consistently.
- Paper texture, if used, should be nearly subliminal and must not reduce legibility.

Depth should come from content hierarchy, not decoration.

## Shapes

Corners should be square or only subtly rounded.

- Essay lists, meeting groupings, and reading surfaces should generally have no visible radius.
- Inputs and buttons may use a restrained `4px` radius for usability.
- Pills are reserved for compact statuses where the shape materially improves scanning; they are not a default label treatment.
- Avoid oversized rounded containers as substitutes for composition.

A future graphic motif may draw from the table: several participants gathered around a shared center, a circle with an opening, or lines converging around a meeting. Use this sparingly. The motif should never overwhelm the wordmark or essays.

## Components

### Masthead and navigation

Use the all-caps `JUNTO` wordmark as the primary identity. Pair it with quiet navigation such as Archive, Meetings, Authors, About, and Member Portal. The masthead should feel like the top of a publication, not an application toolbar.

### Essay listings

Default to text-led editorial rows or columns containing:

- title;
- optional subtitle;
- author;
- meeting and date;
- estimated reading time.

Do not require a cover image. Do not place every essay in an equal rounded card.

### Meeting groupings

A meeting page or homepage feature may foreground:

- meeting number or date;
- theme;
- location only where appropriate and authorized;
- participating authors;
- the essays presented.

The meeting should feel like a record of a real gathering, not a storage folder or calendar event card.

### Buttons and links

Most public navigation should appear as text links with strong hover and focus treatments. Use filled accent buttons only for genuinely high-emphasis actions, such as writing or continuing an essay in the member portal.

### Forms and editor

Forms should be calm, direct, and lightly framed. The Markdown editor may be more recognizably digital, but its rendered preview should use the exact public essay typography. Publication and visibility are separate decisions and must be expressed clearly.

Use the explicit label **Junto members only**, not the ambiguous label **Private**.

### Discussion

Discussion should resemble thoughtful marginalia or correspondence rather than social media:

- full names rather than handles;
- one visible level of replies;
- text-forward composition;
- quiet timestamps;
- no follower counts;
- no reaction bars or popularity metrics;
- no oversized avatar-led layout.

Use the heading **Discussion by Junto members** where public essays expose readable discussion.

## Do's and Don'ts

### Do

- Center essays, authorship, meetings, and sustained reading.
- Use the first approved homepage concept as the primary visual direction.
- Present the main masthead as **JUNTO** in uppercase.
- Organize the archive around real gatherings and their essays.
- Use type, whitespace, rules, and alignment before adding containers.
- Use authentic documentary photography of meetings, drafts, tables, rooms, and chapter cities when available.
- Make the public archive attractive enough that authors are proud to share it.
- Keep the member portal focused on the next meeting, essay deadline, submissions, writing, and discussion.
- Preserve warmth while maintaining intellectual seriousness.

### Don't

- Do not use parchment, quills, seals, Franklin portraits, colonial illustrations, faux-aged paper, heraldry, or reenactment styling.
- Do not use startup gradients, glassmorphism, dark-tech glow, generic feature grids, or icon-topped cards.
- Do not make the homepage a centered hero followed by three generic benefit cards.
- Do not make every essay depend on a thumbnail.
- Do not make the portal a dashboard of invented metrics.
- Do not use likes, follower counts, engagement scores, or social popularity signals.
- Do not let visual branding compete with the writing.
- Do not make Junto feel like Substack with a different logo, a private club, a university department, or a generic community platform.
