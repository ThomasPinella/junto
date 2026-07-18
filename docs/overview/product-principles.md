# 1. Product principles

## 1.1 Essays are the center of the product

Junto is not primarily a social network, chat app, event manager, or community platform.

The central object is the essay.

Meetings organize essays in time. Authors organize essays by person. Comments allow discussion around essays. Chat supports lightweight conversation between meetings.

## 1.2 The public experience should feel editorial

Public pages should resemble a thoughtful publication or literary journal rather than a member dashboard or file repository.

The reading experience should prioritize:

- typography;
- whitespace;
- author identity;
- meeting context;
- related essays;
- comfortable long-form reading;
- simple navigation.

The visual reference is closer to Substack, Aeon, or an independent literary publication than a conventional SaaS dashboard.

## 1.3 Private content must remain private

Private essays, comments attached to inaccessible essays, member chat messages, membership details, and unpublished drafts must never leak through:

- public pages;
- API responses;
- search metadata;
- previews;
- page source;
- Open Graph metadata;
- sitemap generation;
- cached responses.

## 1.4 The application must support multiple Juntos

Every group-scoped entity must be associated with a junto_id.

A member of one Junto must not automatically gain access to another Junto.

The first launch may contain only one active group, but the architecture must not assume that only one group will ever exist.
