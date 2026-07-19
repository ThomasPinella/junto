import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  ESSAY_ADMIN_EMAIL,
  ESSAY_AUTHOR_EMAIL,
  ESSAY_COMEMBER_EMAIL,
  JUNTO_A,
  JUNTO_E,
  MEETING_C_PRIVATE,
  MEETING_E_UPCOMING,
  MEMBER_EMAIL,
  PRIVATE_LOCATION_MARKER,
  PRIVATE_DEADLINE_MARKER_ISO,
  cleanupFixtures,
  clearMailbox,
  deactivateMembership,
  latestAuthLinkFor,
  resetFixtures,
  restAsAnon,
  restAsUser,
  verifyFixturesAbsent,
} from "./fixtures";
import { runExhaustiveLiveTeardown } from "./exhaustive-teardown";

// T05 essay journeys against the real local Supabase stack: draft creation
// with database-derived authorship and same-Junto meeting integrity, draft
// privacy from co-members, the validated publish/unpublish/visibility
// transition path with its explicit public-exposure confirmation, immediate
// revocation, deactivation semantics, and the anon-safe public projection
// that never discloses ids, emails, private fields, or the existence of
// anything ineligible.
//
// The T06 member workspace UI is deliberately deferred, so these journeys
// exercise the real API surface (PostgREST + the transition RPC) with REAL
// session access tokens obtained through real mailbox sign-ins — never the
// service role and never fabricated auth state.
test.describe.configure({ mode: "serial" });

let context: BrowserContext | null = null;
let page: Page;

let authorToken: string;
let comemberToken: string;
let adminToken: string;
let otherJuntoToken: string;

// Captured at publication so the rejected-confirmation journeys can prove
// the timestamp never moved.
let publishedAtBefore: string;

const DRAFT_SLUG = "the-weight-of-attention";
const LASTING_SLUG = "a-lasting-record";
const PRIVATE_CHAPTER_SLUG = "private-chapter-essay";

let draftId: string;
let lastingId: string;

const UUID_SHAPE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// The signed-in user's real Supabase session access token, read from the
// browser context's auth cookies (possibly chunked and base64-prefixed).
async function sessionAccessToken(): Promise<string> {
  if (!context) throw new Error("browser context is unavailable");
  const cookies = await context.cookies();
  const parts = cookies
    .filter((cookie) => /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((cookie) => cookie.value);
  expect(parts.length, "a signed-in Supabase session cookie").toBeGreaterThan(
    0,
  );
  const raw = decodeURIComponent(parts.join(""));
  const json = raw.startsWith("base64-")
    ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8")
    : raw;
  const session = JSON.parse(json) as { access_token?: string };
  if (!session.access_token) {
    throw new Error("session cookie carries no access token");
  }
  return session.access_token;
}

// Real mailbox sign-in, exactly as a member would do it. A single-membership
// account lands directly in its chapter; several land on the chooser.
async function signInThroughMailbox(
  email: string,
  landingUrl: string,
): Promise<void> {
  await clearMailbox();
  await page.goto("/portal/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/check your email/i).first()).toBeVisible();
  const link = await latestAuthLinkFor(email);
  await page.goto(link);
  await expect(page).toHaveURL(landingUrl);
}

async function signOut(juntoSlug: string): Promise<void> {
  await page.goto(`/portal/${juntoSlug}`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/portal\/sign-in/);
}

test.beforeAll(async ({ browser }, testInfo) => {
  await resetFixtures();
  const use = testInfo.project.use;
  context = await browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport,
    userAgent: use.userAgent,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  await runExhaustiveLiveTeardown({
    closeBrowserContext: async () => {
      if (context) await context.close();
    },
    cleanupFixtures,
    verifyFixturesAbsent,
  });
});

test("the essay author activates their invitation through the real mailbox", async () => {
  await signInThroughMailbox(ESSAY_AUTHOR_EMAIL, `/portal/${JUNTO_E.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: JUNTO_E.name }),
  ).toBeVisible();
  authorToken = await sessionAccessToken();
  await signOut(JUNTO_E.slug);
});

test("the non-author Junto admin activates their invitation through the real mailbox", async () => {
  await signInThroughMailbox(ESSAY_ADMIN_EMAIL, `/portal/${JUNTO_E.slug}`);
  adminToken = await sessionAccessToken();
  await signOut(JUNTO_E.slug);
});

test("the co-member and an outside-Junto member obtain their own real sessions", async () => {
  await signInThroughMailbox(ESSAY_COMEMBER_EMAIL, `/portal/${JUNTO_E.slug}`);
  comemberToken = await sessionAccessToken();
  await signOut(JUNTO_E.slug);

  // The T03 member holds two memberships and chooses a chapter.
  await signInThroughMailbox(MEMBER_EMAIL, "/portal");
  await page.getByRole("link", { name: JUNTO_A.name }).click();
  await expect(page).toHaveURL(`/portal/${JUNTO_A.slug}`);
  otherJuntoToken = await sessionAccessToken();
});

test("an active member creates a draft for self in their Junto and its own meeting", async () => {
  const created = await restAsUser(authorToken, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=representation",
    body: {
      junto_id: JUNTO_E.id,
      meeting_id: MEETING_E_UPCOMING.id,
      title: "The Weight of Attention",
      slug: DRAFT_SLUG,
      subtitle: "Notes before the Elm table",
      body_markdown: "# Attention\n\nWhat we notice, we owe.",
    },
  });
  expect(created.status).toBe(201);
  const rows = created.json as Array<Record<string, unknown>>;
  expect(Array.isArray(rows) && rows.length === 1).toBe(true);
  const row = rows[0]!;
  expect(row.status).toBe("draft");
  expect(row.visibility).toBe("members_only");
  expect(row.published_at).toBeNull();
  expect(typeof row.id).toBe("string");
  expect(typeof row.author_id).toBe("string");
  draftId = String(row.id);

  // Identity and publication state can never be client-supplied.
  const forged = await restAsUser(authorToken, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      junto_id: JUNTO_E.id,
      title: "Forged",
      slug: "forged-authorship",
      author_id: "00000000-0000-4000-a000-00000000dead",
    },
  });
  expect(forged.status).toBe(403);
  const forgedStatus = await restAsUser(authorToken, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      junto_id: JUNTO_E.id,
      title: "Forged",
      slug: "forged-status",
      status: "published",
    },
  });
  expect(forgedStatus.status).toBe(403);
});

test("a same-Junto co-member can neither read nor update the draft", async () => {
  const read = await restAsUser(
    comemberToken,
    `/rest/v1/essays?id=eq.${draftId}`,
  );
  expect(read.status).toBe(200);
  expect(read.json).toEqual([]);

  const patch = await restAsUser(
    comemberToken,
    `/rest/v1/essays?id=eq.${draftId}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { title: "hijacked" },
    },
  );
  expect(patch.status).toBeLessThan(300);
  expect(patch.json).toEqual([]);

  // The anonymous internet has no path to the base table at all.
  const anonRead = await restAsAnon(`/rest/v1/essays?id=eq.${draftId}`);
  expect([401, 403]).toContain(anonRead.status);
  expect(anonRead.text).not.toContain(DRAFT_SLUG);
});

test("cross-Junto meeting assignment is rejected by database integrity", async () => {
  const createAcross = await restAsUser(authorToken, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      junto_id: JUNTO_E.id,
      meeting_id: MEETING_C_PRIVATE.id,
      title: "Crossing chapters",
      slug: "crossing-chapters",
    },
  });
  expect(createAcross.status).toBe(409);

  const reassignAcross = await restAsUser(
    authorToken,
    `/rest/v1/essays?id=eq.${draftId}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { meeting_id: MEETING_C_PRIVATE.id },
    },
  );
  expect(reassignAcross.status).toBe(409);

  // And membership boundaries hold on creation: no essay in a chapter the
  // author does not belong to.
  const createOutside = await restAsUser(authorToken, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      junto_id: MEETING_C_PRIVATE.juntoId,
      title: "Outsider",
      slug: "outsider-essay",
    },
  });
  expect(createOutside.status).toBe(403);
});

test("publishing members-only reaches the Junto and nobody else", async () => {
  const published = await restAsUser(
    authorToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: draftId,
        new_status: "published",
        new_visibility: "members_only",
      },
    },
  );
  expect(published.status).toBe(200);
  const rows = published.json as Array<Record<string, unknown>>;
  expect(rows[0]?.status).toBe("published");
  expect(rows[0]?.visibility).toBe("members_only");
  expect(typeof rows[0]?.published_at).toBe("string");
  publishedAtBefore = String(rows[0]?.published_at);

  // The same-Junto member reads it on the very next request.
  const memberRead = await restAsUser(
    comemberToken,
    `/rest/v1/essays?id=eq.${draftId}&select=slug,title,body_markdown,status`,
  );
  expect(memberRead.status).toBe(200);
  const memberRows = memberRead.json as Array<Record<string, unknown>>;
  expect(memberRows).toHaveLength(1);
  expect(memberRows[0]?.body_markdown).toContain("What we notice");

  // The visitor and the other-Junto member get nothing.
  const anonProjection = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${DRAFT_SLUG}`,
  );
  expect(anonProjection.status).toBe(200);
  expect(anonProjection.json).toEqual([]);
  const otherRead = await restAsUser(
    otherJuntoToken,
    `/rest/v1/essays?id=eq.${draftId}`,
  );
  expect(otherRead.status).toBe(200);
  expect(otherRead.json).toEqual([]);
});

test("members-only to public fails closed without explicit confirmation", async () => {
  const unconfirmed = await restAsUser(
    authorToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: draftId,
        new_status: "published",
        new_visibility: "public",
      },
    },
  );
  expect(unconfirmed.status).toBe(400);
  const error = unconfirmed.json as Record<string, unknown>;
  expect(error.message).toBe("confirmation-required");

  const stillHidden = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${DRAFT_SLUG}`,
  );
  expect(stillHidden.json).toEqual([]);
});

test("explicit JSON null never satisfies the author's public-exposure confirmation", async () => {
  // SQL three-valued logic makes `NOT NULL` evaluate to NULL, so only
  // literal boolean true may count as confirmation — an explicit JSON null
  // through the real RPC must fail closed exactly like false and omitted.
  for (const confirm of [null, false]) {
    const attempt = await restAsUser(
      authorToken,
      "/rest/v1/rpc/transition_essay",
      {
        method: "POST",
        body: {
          target_essay_id: draftId,
          new_status: "published",
          new_visibility: "public",
          confirm_public_exposure: confirm,
        },
      },
    );
    expect(attempt.status, `confirm=${String(confirm)}`).toBe(400);
    const error = attempt.json as Record<string, unknown>;
    expect(error.message, `confirm=${String(confirm)}`).toBe(
      "confirmation-required",
    );
  }

  // The essay is unchanged — still members-only, timestamp untouched.
  const authorRead = await restAsUser(
    authorToken,
    `/rest/v1/essays?id=eq.${draftId}&select=status,visibility,published_at`,
  );
  expect(authorRead.json).toEqual([
    {
      status: "published",
      visibility: "members_only",
      published_at: publishedAtBefore,
    },
  ]);

  // And the anonymous internet still sees nothing.
  const anonRead = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${DRAFT_SLUG}`,
  );
  expect(anonRead.status).toBe(200);
  expect(anonRead.json).toEqual([]);
});

test("null status or visibility is rejected as deliberate invalid input", async () => {
  for (const body of [
    {
      target_essay_id: draftId,
      new_status: null,
      new_visibility: "members_only",
    },
    { target_essay_id: draftId, new_status: "published", new_visibility: null },
  ]) {
    const attempt = await restAsUser(
      authorToken,
      "/rest/v1/rpc/transition_essay",
      { method: "POST", body },
    );
    expect(attempt.status, JSON.stringify(body)).toBe(400);
    const error = attempt.json as Record<string, unknown>;
    expect(
      ["invalid-status", "invalid-visibility"],
      JSON.stringify(body),
    ).toContain(error.message);
  }

  const authorRead = await restAsUser(
    authorToken,
    `/rest/v1/essays?id=eq.${draftId}&select=status,visibility,published_at`,
  );
  expect(authorRead.json).toEqual([
    {
      status: "published",
      visibility: "members_only",
      published_at: publishedAtBefore,
    },
  ]);
});

test("the non-author admin's null confirmation is rejected identically", async () => {
  // Confirmation is not weakened for admins: the same-Junto admin holds
  // transition authority over the member's essay, but JSON null and false
  // are never confirmation for them either.
  for (const confirm of [null, false]) {
    const attempt = await restAsUser(
      adminToken,
      "/rest/v1/rpc/transition_essay",
      {
        method: "POST",
        body: {
          target_essay_id: draftId,
          new_status: "published",
          new_visibility: "public",
          confirm_public_exposure: confirm,
        },
      },
    );
    expect(attempt.status, `confirm=${String(confirm)}`).toBe(400);
    const error = attempt.json as Record<string, unknown>;
    expect(error.message, `confirm=${String(confirm)}`).toBe(
      "confirmation-required",
    );
  }

  // The admin's own read proves the essay never left members-only.
  const adminRead = await restAsUser(
    adminToken,
    `/rest/v1/essays?id=eq.${draftId}&select=status,visibility,published_at`,
  );
  expect(adminRead.json).toEqual([
    {
      status: "published",
      visibility: "members_only",
      published_at: publishedAtBefore,
    },
  ]);

  const anonRead = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${DRAFT_SLUG}`,
  );
  expect(anonRead.status).toBe(200);
  expect(anonRead.json).toEqual([]);
});

test("the confirmed transition serves exactly the safe public projection", async () => {
  const confirmed = await restAsUser(
    authorToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: draftId,
        new_status: "published",
        new_visibility: "public",
        confirm_public_exposure: true,
      },
    },
  );
  expect(confirmed.status).toBe(200);

  const anonRead = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${DRAFT_SLUG}`,
  );
  expect(anonRead.status).toBe(200);
  const rows = anonRead.json as Array<Record<string, unknown>>;
  expect(rows).toHaveLength(1);
  const row = rows[0]!;
  expect(Object.keys(row).sort()).toEqual([
    "author_name",
    "author_slug",
    "body_markdown",
    "junto_name",
    "junto_slug",
    "meeting_date",
    "meeting_title",
    "published_at",
    "slug",
    "subtitle",
    "title",
  ]);
  expect(row.title).toBe("The Weight of Attention");
  expect(row.junto_slug).toBe(JUNTO_E.slug);
  expect(row.meeting_date).toBe(MEETING_E_UPCOMING.date);
  expect(row.meeting_title).toBe(MEETING_E_UPCOMING.title);
  expect(row.author_name).toBe("c10-t05-author");

  // No ids, no emails, no private meeting fields, no publication machinery.
  expect(anonRead.text).not.toMatch(UUID_SHAPE);
  expect(anonRead.text).not.toContain("@");
  expect(anonRead.text).not.toContain("example.com");
  expect(anonRead.text.toLowerCase()).not.toContain(
    PRIVATE_LOCATION_MARKER.toLowerCase(),
  );
  expect(anonRead.text).not.toContain(PRIVATE_DEADLINE_MARKER_ISO);
  expect(anonRead.text).not.toContain("members_only");
  expect(anonRead.text).not.toContain('"status"');
  expect(anonRead.text).not.toContain('"visibility"');

  // The projection exposes no foreign keys, so PostgREST cannot embed
  // sensitive relations around it.
  for (const embed of ["essays(*)", "juntos(*)", "profiles(*)"]) {
    const embedded = await restAsAnon(
      `/rest/v1/public_essays?select=*,${embed}`,
    );
    expect(embedded.status, embed).toBe(400);
  }
});

test("returning to members-only revokes anonymous access on the next request", async () => {
  const withdrawn = await restAsUser(
    authorToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: draftId,
        new_status: "published",
        new_visibility: "members_only",
      },
    },
  );
  expect(withdrawn.status).toBe(200);

  const anonRead = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${DRAFT_SLUG}`,
  );
  expect(anonRead.status).toBe(200);
  expect(anonRead.json).toEqual([]);

  // The same-Junto member retains published access.
  const memberRead = await restAsUser(
    comemberToken,
    `/rest/v1/essays?id=eq.${draftId}&select=slug,status`,
  );
  expect(memberRead.json).toEqual([{ slug: DRAFT_SLUG, status: "published" }]);
});

test("unpublishing removes member access while the author keeps the draft", async () => {
  const unpublished = await restAsUser(
    authorToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: draftId,
        new_status: "draft",
        new_visibility: "members_only",
      },
    },
  );
  expect(unpublished.status).toBe(200);
  const rows = unpublished.json as Array<Record<string, unknown>>;
  expect(rows[0]?.status).toBe("draft");
  expect(rows[0]?.published_at).toBeNull();

  const memberRead = await restAsUser(
    comemberToken,
    `/rest/v1/essays?id=eq.${draftId}`,
  );
  expect(memberRead.json).toEqual([]);

  const authorRead = await restAsUser(
    authorToken,
    `/rest/v1/essays?id=eq.${draftId}&select=slug,status`,
  );
  expect(authorRead.json).toEqual([{ slug: DRAFT_SLUG, status: "draft" }]);
});

test("deactivation revokes draft access while published public history remains", async () => {
  // A second essay, published public with confirmation, becomes the
  // author's lasting public record.
  const created = await restAsUser(authorToken, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=representation",
    body: {
      junto_id: JUNTO_E.id,
      meeting_id: MEETING_E_UPCOMING.id,
      title: "A Lasting Record",
      slug: LASTING_SLUG,
      body_markdown: "What was public stays part of the public record.",
    },
  });
  expect(created.status).toBe(201);
  lastingId = String((created.json as Array<Record<string, unknown>>)[0]!.id);
  const published = await restAsUser(
    authorToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: lastingId,
        new_status: "published",
        new_visibility: "public",
        confirm_public_exposure: true,
      },
    },
  );
  expect(published.status).toBe(200);
  const visibleBefore = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${LASTING_SLUG}`,
  );
  expect(visibleBefore.json).toHaveLength(1);

  await deactivateMembership(JUNTO_E.id, ESSAY_AUTHOR_EMAIL);

  // The very next request: no draft access, no transitions, no base rows.
  const draftsAfter = await restAsUser(
    authorToken,
    `/rest/v1/essays?junto_id=eq.${JUNTO_E.id}`,
  );
  expect(draftsAfter.status).toBe(200);
  expect(draftsAfter.json).toEqual([]);
  const transitionAfter = await restAsUser(
    authorToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: lastingId,
        new_status: "draft",
        new_visibility: "public",
      },
    },
  );
  expect(transitionAfter.status).toBe(403);

  // The already-public essay remains part of the public record.
  const visibleAfter = await restAsAnon(
    `/rest/v1/public_essays?slug=eq.${LASTING_SLUG}`,
  );
  expect(visibleAfter.json).toHaveLength(1);
});

test("every ineligible public lookup is one uniform non-disclosing miss", async () => {
  // A published public essay in a PRIVATE-archive chapter must never
  // surface publicly either.
  const created = await restAsUser(otherJuntoToken, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=representation",
    body: {
      junto_id: JUNTO_A.id,
      title: "Private Chapter Essay",
      slug: PRIVATE_CHAPTER_SLUG,
      body_markdown: "A private chapter's public attempt.",
    },
  });
  expect(created.status).toBe(201);
  const privateEssayId = String(
    (created.json as Array<Record<string, unknown>>)[0]!.id,
  );
  const published = await restAsUser(
    otherJuntoToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: privateEssayId,
        new_status: "published",
        new_visibility: "public",
        confirm_public_exposure: true,
      },
    },
  );
  expect(published.status).toBe(200);

  const misses = [
    // The unpublished draft's slug.
    DRAFT_SLUG,
    // A slug that has never existed.
    "no-such-essay-ever",
    // The private-archive chapter's published public essay.
    PRIVATE_CHAPTER_SLUG,
    // A malformed slug.
    "Not%20A%20Slug",
  ];
  const bodies = new Set<string>();
  for (const slug of misses) {
    const res = await restAsAnon(`/rest/v1/public_essays?slug=eq.${slug}`);
    expect(res.status, slug).toBe(200);
    expect(res.json, slug).toEqual([]);
    bodies.add(res.text);
  }
  // Byte-identical: nothing distinguishes private from never-existed.
  expect(bodies.size).toBe(1);
});
