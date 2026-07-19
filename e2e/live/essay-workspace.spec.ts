import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  ESSAY_AUTHOR_EMAIL,
  ESSAY_COMEMBER_EMAIL,
  JUNTO_E,
  MEETING_E_UPCOMING,
  cleanupFixtures,
  clearMailbox,
  deactivateMembership,
  latestAuthLinkFor,
  resetFixtures,
  restAsAnon,
  restAsUser,
  verifyFixturesAbsent,
} from "./fixtures";

// T06 author workspace through the real application, GoTrue mailbox auth,
// PostgREST, and transition RPC. Fixture setup alone is privileged; every
// essay action below is performed by the member's real browser session.
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;
let authorToken: string;
let essayId: string;
let editUrl: string;
let stableSlug: string;

async function signIn(email: string, landing: string): Promise<void> {
  await clearMailbox();
  await page.goto("/portal/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const link = await latestAuthLinkFor(email);
  await page.goto(link);
  await expect(page).toHaveURL(landing);
}

async function accessToken(): Promise<string> {
  const cookies = await context.cookies();
  const raw = decodeURIComponent(
    cookies
      .filter((cookie) => /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      )
      .map((cookie) => cookie.value)
      .join(""),
  );
  const json = raw.startsWith("base64-")
    ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8")
    : raw;
  const session = JSON.parse(json) as { access_token?: string };
  if (!session.access_token)
    throw new Error("session cookie has no access token");
  return session.access_token;
}

async function signOut(): Promise<void> {
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
  await context.close();
  const errors: string[] = [];
  try {
    await cleanupFixtures();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  try {
    await verifyFixturesAbsent();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (errors.length) throw new Error(`teardown failed — ${errors.join("; ")}`);
});

test("author creates, saves, reloads, edits, and previews a meeting essay", async () => {
  await signIn(ESSAY_AUTHOR_EMAIL, `/portal/${JUNTO_E.slug}`);
  authorToken = await accessToken();
  await page.goto(`/portal/${JUNTO_E.slug}/essays`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Essays" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Write essay" }).click();
  // The live suite intentionally exercises transient protected-read outage
  // behavior elsewhere. If the first request lands during that bounded
  // window, use the page's real recovery control once before continuing.
  const unavailable = page.getByRole("heading", {
    name: "The writing room is unavailable",
  });
  if (await unavailable.isVisible()) {
    await page.getByRole("button", { name: "Try again" }).click();
  }
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("The T06 Writing Room");
  await page.getByLabel(/Subtitle/).fill("A live author journey");
  await page.getByLabel("Meeting").selectOption(MEETING_E_UPCOMING.id);
  await page
    .getByLabel("Essay in Markdown")
    .fill("## A real preview\n\nWhat we **save** should return unchanged.");
  await expect(
    page.getByRole("heading", { level: 2, name: "A real preview" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  editUrl = new URL(page.url()).pathname;
  essayId = editUrl.split("/").at(-2) ?? "";
  stableSlug =
    (await page.getByText(/Stable slug:/).textContent())
      ?.replace("Stable slug:", "")
      .trim() ?? "";
  expect(essayId).toMatch(/^[0-9a-f-]{36}$/);
  expect(stableSlug).toBe("the-t06-writing-room");

  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("The T06 Writing Room");
  await expect(page.getByLabel("Meeting")).toHaveValue(MEETING_E_UPCOMING.id);
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("A Completely New Title");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Essay saved");
  await expect(page.getByText(/Stable slug:/)).toContainText(stableSlug);

  await page.getByRole("link", { name: "Open saved preview" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "A Completely New Title" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "A real preview" }),
  ).toBeVisible();

  const persisted = await restAsUser(
    authorToken,
    `/rest/v1/essays?id=eq.${essayId}&select=slug,title,meeting_id,status,visibility`,
  );
  expect(persisted.json).toEqual([
    {
      slug: stableSlug,
      title: "A Completely New Title",
      meeting_id: MEETING_E_UPCOMING.id,
      status: "draft",
      visibility: "members_only",
    },
  ]);
});

test("members-only publish, public confirmation, revocation, and unpublish are immediate", async () => {
  await page.goto(editUrl);
  await page.getByRole("button", { name: "Publish essay" }).click();
  await expect(page.getByRole("status")).toContainText("Essay published");
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  expect(
    (await restAsAnon(`/rest/v1/public_essays?slug=eq.${stableSlug}`)).json,
  ).toEqual([]);

  await page.getByRole("radio", { name: /Public/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Nothing was made public" }),
  ).toBeVisible();
  expect(
    (await restAsAnon(`/rest/v1/public_essays?slug=eq.${stableSlug}`)).json,
  ).toEqual([]);

  await page.getByRole("radio", { name: /Public/ }).check();
  await page.getByRole("checkbox", { name: /anyone on the internet/i }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Essay saved");
  expect(
    (await restAsAnon(`/rest/v1/public_essays?slug=eq.${stableSlug}`)).json,
  ).toHaveLength(1);

  await page.getByRole("radio", { name: /Junto members only/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect
    .poll(
      async () =>
        (await restAsAnon(`/rest/v1/public_essays?slug=eq.${stableSlug}`)).json,
    )
    .toEqual([]);

  await page.getByRole("radio", { name: /Public/ }).check();
  await page.getByRole("checkbox", { name: /anyone on the internet/i }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect
    .poll(
      async () =>
        (await restAsAnon(`/rest/v1/public_essays?slug=eq.${stableSlug}`)).json,
    )
    .toHaveLength(1);

  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByRole("status")).toContainText("author-only draft");
  await expect
    .poll(
      async () =>
        (await restAsAnon(`/rest/v1/public_essays?slug=eq.${stableSlug}`)).json,
    )
    .toEqual([]);
});

test("another author and a deactivated author receive uniform protected denials", async () => {
  await signOut();
  await signIn(ESSAY_COMEMBER_EMAIL, `/portal/${JUNTO_E.slug}`);
  await page.goto(editUrl);
  await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
  await page.goto(`/portal/${JUNTO_E.slug}`);
  await signOut();

  await signIn(ESSAY_AUTHOR_EMAIL, `/portal/${JUNTO_E.slug}`);
  await deactivateMembership(JUNTO_E.id, ESSAY_AUTHOR_EMAIL);
  await page.goto(editUrl);
  await expect(page).toHaveURL(/\/portal(?:\?|$)/);
  await expect(page.getByText(JUNTO_E.name)).toHaveCount(0);
});
