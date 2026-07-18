# AGENTS.md

## Project

Junto is a public essay archive and private member portal for recurring, in-person, essay-based discussion groups. The essay is the central object; meetings organize essays in time, comments extend discussion, and chat remains lightweight.

The application will be a **Next.js + TypeScript** project hosted on **Railway**, using **Supabase** for Postgres, authentication, Row Level Security, storage where needed, and realtime features.

## Read before changing code

Start with [docs/README.md](docs/README.md), which maps the product documentation. In particular:

- Product purpose and principles: [docs/overview/vision-and-practice.md](docs/overview/vision-and-practice.md) and [docs/overview/product-principles.md](docs/overview/product-principles.md)
- MVP boundary and settled rules: [docs/planning/mvp-scope.md](docs/planning/mvp-scope.md) and [docs/planning/product-decisions.md](docs/planning/product-decisions.md)
- Data and authorization: [docs/architecture/data-model.md](docs/architecture/data-model.md) and [docs/architecture/authorization.md](docs/architecture/authorization.md)
- Design source of truth: [DESIGN.md](DESIGN.md), [docs/design/README.md](docs/design/README.md), and [docs/design/surface-guidelines.md](docs/design/surface-guidelines.md)

Read the feature-specific document before implementing that feature. Do not invent product behavior when the docs already decide it. If implementation requires changing a settled behavior or MVP boundary, update the relevant documentation deliberately rather than letting code become a competing source of truth.

## Product invariants

- Essays are the center of the product. Do not optimize around feeds, engagement, or generic community mechanics.
- Public pages should feel like a literary publication; private pages should feel like a focused writing room and chapter tool.
- The system is multi-Junto from the beginning. Every group-scoped record must carry a `junto_id`, and access in one Junto must never imply access in another.
- Public, members-only, and draft visibility are distinct. Never expose private content through pages, queries, realtime subscriptions, metadata, previews, sitemaps, logs, or caches.
- Publication status and visibility are separate concepts.
- Do not add excluded MVP features—likes, follows, reactions, public registration/commenting, DMs, recommendation algorithms, or similar mechanics—without an explicit product decision.

## Architecture and security

- Use the Next.js App Router and strict TypeScript.
- Prefer Server Components. Add `"use client"` only when browser APIs or interactive state require it, and keep the client boundary narrow.
- Keep privileged data access and secrets on the server. Never expose the Supabase service-role key to browser code.
- Treat Supabase Row Level Security as an authorization boundary, not optional hardening. UI checks do not replace RLS policies.
- Derive identity from the authenticated Supabase user; do not trust client-supplied `user_id`, role, `junto_id`, or ownership fields.
- Validate all external input at server boundaries. Sanitize rendered Markdown and reject unsafe HTML or scripts.
- Put schema changes and RLS policies in versioned Supabase migrations. Test both allowed access and denied cross-user/cross-Junto access.
- Realtime channels must enforce the same authorization model as ordinary reads.
- Railway services must be stateless. Do not rely on local disk for durable data. Configuration belongs in environment variables; fail clearly when required variables are missing.

## Code standards

- Follow the existing package manager and lockfile; do not introduce a second package manager.
- Prefer small, explicit modules and descriptive names over clever abstractions.
- Keep feature code close to the route or feature that owns it. Move code into shared modules only when it is genuinely shared.
- Separate data access, authorization, domain logic, and presentation where doing so makes security and testing clearer.
- Avoid `any`, unsafe type assertions, silent error swallowing, and non-null assertions without a proven invariant.
- Use server-side authorization before mutations and return errors that are useful without leaking private information.
- Do not add dependencies for trivial utilities. Explain unusually consequential dependency choices.
- Comments should explain why, policy, or non-obvious constraints—not restate the code.

## UI and content standards

- Follow `DESIGN.md`; do not substitute generic SaaS styling.
- Use the all-caps **JUNTO** masthead in primary publication contexts.
- Let typography, whitespace, alignment, and fine rules create hierarchy before adding cards, shadows, icons, or color.
- Preserve comfortable long-form reading: approximately `65–72ch`, generous line height, and minimal chrome.
- Prefer text-led editorial lists over repeated rounded cards. Do not require cover imagery for every essay.
- Use explicit privacy language such as **Junto members only**, not merely **Private**.
- Build accessible interfaces: semantic HTML, keyboard operation, visible focus, labeled controls, sufficient contrast, and at least 44px mobile targets.
- Respect `prefers-reduced-motion`. Motion should clarify state, not decorate the page.
- Do not use gradients, glassmorphism, faux-antique motifs, engagement metrics, or historical cosplay.

## Testing and verification

When project tooling is scaffolded, maintain standard scripts for `lint`, `typecheck`, `test`, `test:e2e`, and `build`. Use the repository’s actual scripts rather than guessing commands.

Before declaring work complete:

1. Run the relevant formatter, linter, type checker, and tests.
2. Run a production build for changes that can affect compilation, routing, or deployment.
3. Test authorization changes from allowed and denied perspectives, including cross-Junto access.
4. Exercise the affected user journey rather than relying only on unit tests.
5. Check responsive behavior and accessibility for UI changes.
6. Report exactly what was run and any checks that could not be run.

Do not bypass failing checks or weaken tests, lint rules, TypeScript, RLS, or validation merely to make a change pass.

## Scope and workflow

- Keep changes focused. Avoid unrelated refactors while implementing a feature.
- Preserve user work and repository changes; do not reset, overwrite, or delete unrelated modifications.
- Never commit secrets or real member data. Use documented placeholders in examples and tests.
- Update documentation when architecture, product behavior, or design conventions change.
- Treat deployment, destructive migrations, production data changes, opening pull requests, and merging as explicit human approval boundaries.
