# V01 final integrated review

- Range: `a16b63504c66445b57ad11a296e0a3baffbd6efa..f4d0e4ab912251af9b9d20dea69ae84295baee2e`
- Verdict: **FAIL — correction required**

## Blockers

### 1. Medium — genuine sitemap failure path drops the four static URLs

`src/app/sitemap.ts` returns `[]` when any public-data query throws. A timeout, transport failure, malformed response, or Supabase error therefore produces an empty sitemap, contrary to the approved unavailable-data fallback of exactly `/`, `/essays`, `/authors`, and `/meetings`.

The immediate-404 stack-free test does not prove this branch: PostgREST normalizes that response into empty successful datasets, so `buildPublicSitemap` supplies the four URLs without entering `catch`.

**Smallest correction:** return `buildPublicSitemap(site.siteUrl, [], [], [])` from `catch`, and add a focused regression that forces a query rejection/error response.

### 2. Low — new chapter route lacks the portal frame and `<main>` skip target

`src/app/portal/chapters/new/page.tsx` returns its article directly while the parent portal layout is transparent. The global skip link points to a nonexistent `#main-content`, and this authenticated route lacks the standard masthead and sign-out shell.

**Smallest correction:** wrap the page in existing `PortalFrame`, with `SignOutButton` as the aside, as other unselected portal pages do.

## Non-blocking observations and evidence limits

- This run uses `implementation.md` rather than the absent `plan.md`; the reviewer inspected the available implementation/source-scope/log/report records and complete diff.
- `src/config/site.ts` retains harmless legacy initial-chapter label helpers no longer consumed by product code.
- The integrated evidence ledger is otherwise internally credible. C02's invalid historical browser claim is correctly excluded. Later C03/C05/integrated reproductions and DB/live teardown evidence are consistent. Only the sitemap test description overclaimed the true exception branch.
- Topology is linear and correct; candidate worktree/index are clean and diff check passed.

## Prior findings

- Reserved exact `sign-in`: resolved.
- Authorization-before-validation/uniqueness proof: resolved.
- Date-only cross-chapter meeting wording: resolved.
- Absent/ineligible configured initial slug: resolved.
- Four-static-URL unavailable sitemap fallback: unresolved for real exceptions.
