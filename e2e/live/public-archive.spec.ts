import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  JUNTO_P,
  MEETING_C_PRIVATE,
  MEETING_P_COMPLETED,
  MEETING_P_UPCOMING,
  MEETING_Q_INACTIVE,
  PRIVATE_LOCATION_MARKER,
  PUBLIC_AUTHOR_A_EMAIL,
  PUBLIC_AUTHOR_B_EMAIL,
  cleanupFixtures,
  clearMailbox,
  latestAuthLinkFor,
  resetFixtures,
  restAsUser,
  verifyFixturesAbsent,
} from "./fixtures";
import { runExhaustiveLiveTeardown } from "./exhaustive-teardown";

test.describe.configure({ mode: "serial" });

let context: BrowserContext | undefined;
let page: Page;
let mayaToken: string;
let danielToken: string;
let featureId: string;

const FEATURE_SLUG = "the-discipline-of-noticing";
const MAYA_SECOND_SLUG = "what-we-keep-in-common";
const DANIEL_SLUG = "a-duty-to-future-neighbors";
const DRAFT_MARKER = "C17 draft words must remain absent";
const MEMBERS_MARKER = "C17 members-only words must remain absent";

async function sessionAccessToken(): Promise<string> {
  if (!context) throw new Error("browser context unavailable");
  const cookies = await context.cookies();
  const parts = cookies
    .filter((cookie) => /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((cookie) => cookie.value);
  const raw = decodeURIComponent(parts.join(""));
  const json = raw.startsWith("base64-")
    ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8")
    : raw;
  const session = JSON.parse(json) as { access_token?: string };
  if (!session.access_token) throw new Error("session carries no access token");
  return session.access_token;
}

async function signIn(email: string): Promise<string> {
  await clearMailbox();
  await page.goto("/portal/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.goto(await latestAuthLinkFor(email));
  await expect(page).toHaveURL(`/portal/${JUNTO_P.slug}`);
  const token = await sessionAccessToken();
  await page.getByRole("button", { name: "Sign out" }).click();
  return token;
}

async function createEssay(
  token: string,
  input: {
    slug: string;
    title: string;
    subtitle?: string;
    body: string;
    meetingId: string;
    visibility?: "public" | "members_only";
    publish?: boolean;
  },
): Promise<string> {
  const created = await restAsUser(token, "/rest/v1/essays", {
    method: "POST",
    prefer: "return=representation",
    body: {
      junto_id: JUNTO_P.id,
      meeting_id: input.meetingId,
      title: input.title,
      slug: input.slug,
      subtitle: input.subtitle,
      body_markdown: input.body,
    },
  });
  expect(created.status).toBe(201);
  const id = String((created.json as Array<{ id: string }>)[0]!.id);
  if (input.publish) {
    const published = await restAsUser(token, "/rest/v1/rpc/transition_essay", {
      method: "POST",
      body: {
        target_essay_id: id,
        new_status: "published",
        new_visibility: input.visibility ?? "public",
        confirm_public_exposure: input.visibility !== "members_only",
      },
    });
    expect(published.status).toBe(200);
  }
  return id;
}

async function expectNoOverflow(): Promise<void> {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
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
  mayaToken = await signIn(PUBLIC_AUTHOR_A_EMAIL);
  danielToken = await signIn(PUBLIC_AUTHOR_B_EMAIL);

  featureId = await createEssay(mayaToken, {
    slug: FEATURE_SLUG,
    title: "The Discipline of Noticing",
    subtitle: "Attention as a civic obligation",
    meetingId: MEETING_P_UPCOMING.id,
    body:
      "## A claim\n\nAttention is the beginning of public care.\n\n" +
      "> We owe the world a patient look.\n\n" +
      "- Notice what is present\n- Name what is missing\n\n---\n\n" +
      "[Read the practice](/about).\n\n" +
      "Sustained thought belongs at the table. ".repeat(180),
    publish: true,
  });
  await createEssay(mayaToken, {
    slug: MAYA_SECOND_SLUG,
    title: "What We Keep in Common",
    meetingId: MEETING_P_COMPLETED.id,
    body: "A second public argument about common life.",
    publish: true,
  });
  await createEssay(danielToken, {
    slug: DANIEL_SLUG,
    title: "A Duty to Future Neighbors",
    meetingId: MEETING_P_UPCOMING.id,
    body: "Public obligation extends beyond the people we already know.",
    publish: true,
  });
  await createEssay(mayaToken, {
    slug: "unfinished-private-draft",
    title: "Unfinished Private Draft",
    meetingId: MEETING_P_UPCOMING.id,
    body: DRAFT_MARKER,
  });
  await createEssay(danielToken, {
    slug: "members-room-notes",
    title: "Members Room Notes",
    meetingId: MEETING_P_UPCOMING.id,
    body: MEMBERS_MARKER,
    visibility: "members_only",
    publish: true,
  });
});

test.afterAll(async () => {
  await runExhaustiveLiveTeardown({
    closeBrowserContext: async () => context?.close(),
    cleanupFixtures,
    verifyFixturesAbsent,
  });
});

test("homepage leads with a meeting and reaches a recent essay", async ({}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The century ahead" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "The Discipline of Noticing" }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/c17-home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "The Discipline of Noticing" })
    .first()
    .click();
  await expect(page).toHaveURL(`/essays/${FEATURE_SLUG}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Discipline of Noticing" }),
  ).toBeVisible();
  await expectNoOverflow();
});

test("reading page renders long-form semantics and related public work", async ({}, testInfo) => {
  const article = page.locator("article");
  await expect(
    article.getByRole("heading", { level: 2, name: "A claim" }),
  ).toBeVisible();
  await expect(article.locator("blockquote")).toContainText("patient look");
  await expect(article.locator("ul").first()).toContainText(
    "Notice what is present",
  );
  await expect(
    page.getByRole("heading", { name: /More from c17-public-maya/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Other essays from the meeting" }),
  ).toBeVisible();
  const bodyStyle = await article
    .locator("h2", { hasText: "A claim" })
    .evaluate((element) => {
      const container = element.parentElement!;
      const style = getComputedStyle(container);
      return {
        fontSize: parseFloat(style.fontSize),
        lineHeight: parseFloat(style.lineHeight),
      };
    });
  expect(bodyStyle.fontSize).toBeGreaterThanOrEqual(18);
  expect(bodyStyle.lineHeight / bodyStyle.fontSize).toBeGreaterThanOrEqual(1.6);
  await page.screenshot({
    path: `/tmp/c17-essay-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("archive browses canonically by author and meeting", async () => {
  await page.goto("/authors/c17-public-maya");
  await page
    .getByRole("link", { name: "Browse this author in the essay archive" })
    .click();
  await expect(page).toHaveURL("/essays?author=c17-public-maya");
  await expect(
    page.getByText("Showing essays by c17-public-maya."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "A Duty to Future Neighbors" }),
  ).toHaveCount(0);

  await page.goto(
    `/juntos/${JUNTO_P.slug}/meetings/${MEETING_P_UPCOMING.date}`,
  );
  await page.getByRole("link", { name: "Browse in the archive" }).click();
  await expect(page).toHaveURL(`/essays?meeting=${MEETING_P_UPCOMING.date}`);
  await expect(
    page.getByRole("link", { name: "A Duty to Future Neighbors" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "What We Keep in Common" }),
  ).toHaveCount(0);
});

test("authors index and meeting proceedings expose only public participants", async () => {
  await page.goto("/authors");
  await page.getByRole("link", { name: "c17-public-daniel" }).click();
  await expect(page).toHaveURL("/authors/c17-public-daniel");
  await expect(
    page.getByRole("link", { name: "A Duty to Future Neighbors" }),
  ).toBeVisible();

  await page.goto(
    `/juntos/${JUNTO_P.slug}/meetings/${MEETING_P_UPCOMING.date}`,
  );
  await expect(
    page.getByRole("link", { name: "The Discipline of Noticing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "c17-public-maya" }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "c17-public-daniel" }).last(),
  ).toBeVisible();
  const source = await page.content();
  for (const hidden of [
    DRAFT_MARKER,
    MEMBERS_MARKER,
    "Unfinished Private Draft",
    "Members Room Notes",
    PRIVATE_LOCATION_MARKER,
    MEETING_C_PRIVATE.title!,
    MEETING_Q_INACTIVE.title!,
  ])
    expect(source).not.toContain(hidden);
  await expectNoOverflow();
});

test("metadata and sitemap contain eligible URLs and no hidden records", async () => {
  await page.goto(`/essays/${FEATURE_SLUG}`);
  await expect(page).toHaveTitle(/The Discipline of Noticing/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "The Discipline of Noticing",
  );
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`/essays/${FEATURE_SLUG}`);
  expect(sitemap).toContain("/authors/c17-public-maya");
  expect(sitemap).not.toContain("unfinished-private-draft");
  expect(sitemap).not.toContain("members-room-notes");
  expect(sitemap).not.toContain(MEETING_C_PRIVATE.date);
  expect(sitemap).not.toContain(MEETING_Q_INACTIVE.date);
});

test("visibility revocation disappears from pages, metadata, and sitemap next request", async () => {
  const withdrawn = await restAsUser(
    mayaToken,
    "/rest/v1/rpc/transition_essay",
    {
      method: "POST",
      body: {
        target_essay_id: featureId,
        new_status: "published",
        new_visibility: "members_only",
      },
    },
  );
  expect(withdrawn.status).toBe(200);
  await page.goto(`/essays/${FEATURE_SLUG}`);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/^Essay · Junto$/);
  expect(await (await page.request.get("/sitemap.xml")).text()).not.toContain(
    FEATURE_SLUG,
  );
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "The Discipline of Noticing" }),
  ).toHaveCount(0);
});
