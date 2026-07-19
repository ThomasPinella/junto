import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import {
  ESSAY_COMEMBER_EMAIL,
  INTEGRATED_MEMBER_EMAIL,
  JUNTO_E,
  JUNTO_P,
  PUBLIC_AUTHOR_A_EMAIL,
  cleanupFixtures,
  clearMailbox,
  latestAuthLinkFor,
  resetFixtures,
  restAsAnon,
  restAsUser,
  verifyFixturesAbsent,
} from "./fixtures";
import {
  closeBrowserContextsExhaustively,
  runExhaustiveLiveTeardown,
} from "./exhaustive-teardown";

test.describe.configure({ mode: "serial" });

const ESSAY_TITLE = "The T08 Complete Loop";
const ESSAY_SLUG = "the-t08-complete-loop";
const MEETING_TITLE = "The responsibilities of a public record";
const SAFE_MARKER = "A civic archive earns trust by keeping its boundaries.";
const PRIVATE_MARKER = "C22 private controls must never enter public source";

let adminContext: BrowserContext | null = null;
let memberContext: BrowserContext | null = null;
let outsiderContext: BrowserContext | null = null;
let anonymousContext: BrowserContext | null = null;
let adminPage: Page;
let memberPage: Page;
let outsiderPage: Page;
let anonymousPage: Page;
let adminToken: string;
let memberToken: string;
let outsiderToken: string;
let meetingId: string;
let meetingDate: string;
let essayId: string;
let editPath: string;

async function newConfiguredContext(
  browser: Browser,
  use: {
    baseURL?: string;
    viewport?: { width: number; height: number } | null;
    userAgent?: string;
    isMobile?: boolean;
    hasTouch?: boolean;
    deviceScaleFactor?: number;
  },
): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport,
    userAgent: use.userAgent,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
  });
}

async function accessToken(context: BrowserContext): Promise<string> {
  const raw = decodeURIComponent(
    (await context.cookies())
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

function jwtSubject(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  if (!payload) throw new Error("access token has no JWT payload");
  const claims = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as { sub?: string };
  if (!claims.sub) throw new Error("access token has no subject claim");
  return claims.sub;
}

async function mailboxSignIn(
  page: Page,
  context: BrowserContext,
  email: string,
  landing: string,
): Promise<string> {
  await clearMailbox();
  await page.goto("/portal/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/check your email/i).first()).toBeVisible();
  await page.goto(await latestAuthLinkFor(email));
  await expect(page).toHaveURL(landing);
  return accessToken(context);
}

test.beforeAll(async ({ browser }, testInfo) => {
  await resetFixtures();
  const use = testInfo.project.use;
  adminContext = await newConfiguredContext(browser, use);
  memberContext = await newConfiguredContext(browser, use);
  outsiderContext = await newConfiguredContext(browser, use);
  anonymousContext = await newConfiguredContext(browser, use);
  adminPage = await adminContext.newPage();
  memberPage = await memberContext.newPage();
  outsiderPage = await outsiderContext.newPage();
  anonymousPage = await anonymousContext.newPage();
});

test.afterAll(async () => {
  await runExhaustiveLiveTeardown({
    closeBrowserContext: async () => {
      await closeBrowserContextsExhaustively(
        [adminContext, memberContext, outsiderContext, anonymousContext].filter(
          (context): context is BrowserContext => context !== null,
        ),
      );
    },
    cleanupFixtures,
    verifyFixturesAbsent,
  });
});

test("a Poplar admin creates exactly one confirmed invitation through the UI", async () => {
  adminToken = await mailboxSignIn(
    adminPage,
    adminContext!,
    PUBLIC_AUTHOR_A_EMAIL,
    `/portal/${JUNTO_P.slug}`,
  );
  await adminPage.goto(`/portal/${JUNTO_P.slug}/admin`);
  const email = adminPage.getByLabel("Email address");
  await email.fill(INTEGRATED_MEMBER_EMAIL.toUpperCase());

  // Remove only the browser's first-line required constraint so the server
  // receives a forged unchecked submission. It must still fail closed.
  const confirmation = adminPage.getByLabel(
    /I confirm this person is approved/i,
  );
  await confirmation.evaluate((element) => element.removeAttribute("required"));
  await adminPage.getByRole("button", { name: "Invite a member" }).click();
  await expect(
    adminPage.getByRole("alert").filter({
      hasText: "Confirm that this person is approved",
    }),
  ).toBeVisible();
  expect(
    (
      await restAsUser(
        adminToken,
        `/rest/v1/junto_invitations?email_normalized=eq.${INTEGRATED_MEMBER_EMAIL}&select=id`,
      )
    ).json,
  ).toEqual([]);

  await email.fill(INTEGRATED_MEMBER_EMAIL.toUpperCase());
  await adminPage.getByLabel(/I confirm this person is approved/i).check();
  await adminPage.getByRole("button", { name: "Invite a member" }).click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Invitation created",
  );
  const invitations = await restAsUser(
    adminToken,
    `/rest/v1/junto_invitations?email_normalized=eq.${INTEGRATED_MEMBER_EMAIL}` +
      "&select=junto_id,email_normalized,role,status",
  );
  expect(invitations.json).toEqual([
    {
      junto_id: JUNTO_P.id,
      email_normalized: INTEGRATED_MEMBER_EMAIL,
      role: "member",
      status: "pending",
    },
  ]);
});

test("the invited mailbox claims only its intended active Junto membership", async () => {
  memberToken = await mailboxSignIn(
    memberPage,
    memberContext!,
    INTEGRATED_MEMBER_EMAIL,
    `/portal/${JUNTO_P.slug}`,
  );
  await expect(
    memberPage.getByRole("heading", { level: 1, name: JUNTO_P.name }),
  ).toBeVisible();
  const memberships = await restAsUser(
    memberToken,
    `/rest/v1/junto_members?user_id=eq.${jwtSubject(memberToken)}` +
      "&select=junto_id,role,status",
  );
  expect(memberships.json).toEqual([
    { junto_id: JUNTO_P.id, role: "member", status: "active" },
  ]);
});

test("the administrator schedules the essay's meeting through the UI", async () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 55);
  meetingDate = date.toISOString().slice(0, 10);

  await adminPage.goto(`/portal/${JUNTO_P.slug}/admin`);
  await adminPage.getByRole("link", { name: "Schedule a meeting" }).click();
  await adminPage.getByLabel("Meeting date").fill(meetingDate);
  await adminPage.getByLabel("Title").fill(MEETING_TITLE);
  await adminPage.getByLabel("Theme").fill("Stewardship");
  await adminPage
    .getByLabel("Description")
    .fill("A complete invitation-to-publication proof around one table.");
  await adminPage.getByLabel("Location").fill(PRIVATE_MARKER);
  await adminPage.getByRole("button", { name: "Schedule meeting" }).click();
  await expect(adminPage).toHaveURL(
    new RegExp(`/portal/${JUNTO_P.slug}/meetings/[0-9a-f-]{36}`),
  );
  const match = adminPage.url().match(/\/meetings\/([0-9a-f-]{36})/);
  if (!match?.[1]) throw new Error("created meeting id missing from URL");
  meetingId = match[1];
  await expect(adminPage.getByText("Meeting scheduled.")).toBeVisible();
});

test("the member writes, previews, saves, and deliberately publishes safe Markdown", async () => {
  await memberPage.goto(`/portal/${JUNTO_P.slug}/essays/new`);
  await memberPage.getByLabel("Title", { exact: true }).fill(ESSAY_TITLE);
  await memberPage.getByLabel("Meeting").selectOption(meetingId);
  await memberPage
    .getByLabel("Essay in Markdown")
    .fill(
      [
        "## A tested boundary",
        "",
        SAFE_MARKER,
        "",
        "> The public record should preserve thought without weakening privacy.",
        "",
        "[A safe internal path](/about)",
        "",
        "[An unsafe executable path](javascript:alert('c22'))",
        "",
        "<script>window.c22Executed = true</script>",
        '<img src="x" onerror="window.c22Executed = true">',
      ].join("\n"),
    );
  const previewHeading = memberPage.getByRole("heading", {
    level: 2,
    name: "A tested boundary",
  });
  await expect(previewHeading).toBeVisible();
  const previewTypography = await previewHeading.evaluate((element) => {
    const container = element.parentElement!;
    const style = getComputedStyle(container);
    return {
      fontSize: parseFloat(style.fontSize),
      lineHeight: parseFloat(style.lineHeight),
    };
  });
  expect(previewTypography.fontSize).toBeGreaterThanOrEqual(18);
  expect(
    previewTypography.lineHeight / previewTypography.fontSize,
  ).toBeGreaterThanOrEqual(1.6);

  await memberPage.getByRole("button", { name: "Save draft" }).click();
  await expect(memberPage.getByRole("status")).toContainText("Draft saved");
  editPath = new URL(memberPage.url()).pathname;
  essayId = editPath.split("/").at(-2) ?? "";
  expect(essayId).toMatch(/^[0-9a-f-]{36}$/);
  await memberPage.getByRole("link", { name: "Open saved preview" }).click();
  await expect(memberPage).toHaveURL(
    `${editPath.replace(/\/edit$/, "")}/preview`,
  );
  await expect(
    memberPage.getByText(SAFE_MARKER, { exact: true }),
  ).toBeVisible();
  await expect(memberPage.locator("article script, article img")).toHaveCount(
    0,
  );

  await memberPage.goto(editPath);
  await memberPage.getByRole("radio", { name: /Public/ }).check();
  const publicConfirmation = memberPage.getByRole("checkbox", {
    name: /anyone on the internet/i,
  });
  await expect(publicConfirmation).not.toBeChecked();
  const publishButton = memberPage.getByRole("button", {
    name: "Publish essay",
  });
  await publishButton.evaluate((element) =>
    element.setAttribute("formnovalidate", ""),
  );
  await publishButton.click();
  await expect(
    memberPage
      .getByRole("alert")
      .filter({ hasText: "Confirm that you intend" }),
  ).toBeVisible();
  expect(
    (await restAsAnon(`/rest/v1/public_essays?slug=eq.${ESSAY_SLUG}`)).json,
  ).toEqual([]);

  await memberPage.getByRole("radio", { name: /Public/ }).check();
  await memberPage
    .getByRole("checkbox", { name: /anyone on the internet/i })
    .check();
  await memberPage.getByRole("button", { name: "Publish essay" }).click();
  await expect(memberPage.getByRole("status")).toContainText("Essay published");
});

test("an anonymous visitor reaches archive, proceedings, and canonical reading", async () => {
  await anonymousPage.goto("/");
  await expect(
    anonymousPage.getByRole("link", { name: ESSAY_TITLE }).first(),
  ).toBeVisible();
  await anonymousPage.goto("/essays");
  await expect(
    anonymousPage.getByRole("link", { name: ESSAY_TITLE }),
  ).toBeVisible();
  await anonymousPage.goto(`/juntos/${JUNTO_P.slug}/meetings/${meetingDate}`);
  await expect(
    anonymousPage.getByRole("heading", { level: 1, name: MEETING_TITLE }),
  ).toBeVisible();
  await expect(
    anonymousPage.getByRole("link", { name: ESSAY_TITLE }),
  ).toBeVisible();
  expect(await anonymousPage.content()).not.toContain(PRIVATE_MARKER);

  const response = await anonymousPage.goto(`/essays/${ESSAY_SLUG}`);
  expect(response?.status()).toBe(200);
  await expect(
    anonymousPage.getByRole("heading", { level: 1, name: ESSAY_TITLE }),
  ).toBeVisible();
  await expect(anonymousPage.getByText(SAFE_MARKER)).toBeVisible();
  await expect(
    anonymousPage.locator("article script, article img"),
  ).toHaveCount(0);
  await expect(
    anonymousPage.getByRole("link", { name: "An unsafe executable path" }),
  ).toHaveCount(0);
  expect(
    await anonymousPage.evaluate(
      () => (window as unknown as Record<string, unknown>).c22Executed,
    ),
  ).toBeUndefined();
});

test("a second-Junto user receives uniform private denials", async () => {
  outsiderToken = await mailboxSignIn(
    outsiderPage,
    outsiderContext!,
    ESSAY_COMEMBER_EMAIL,
    `/portal/${JUNTO_E.slug}`,
  );
  expect(
    (
      await restAsUser(
        outsiderToken,
        `/rest/v1/essays?id=eq.${essayId}&select=id,title,body_markdown`,
      )
    ).json,
  ).toEqual([]);
  await outsiderPage.goto(editPath);
  await expect(outsiderPage).toHaveURL(`/portal/${JUNTO_E.slug}`);
  await expect(outsiderPage.getByText(ESSAY_TITLE)).toHaveCount(0);
  await outsiderPage.goto(`/portal/${JUNTO_P.slug}/meetings/${meetingId}`);
  await expect(outsiderPage).toHaveURL(`/portal/${JUNTO_E.slug}`);
  await expect(outsiderPage.getByText(MEETING_TITLE)).toHaveCount(0);
});

test("admin deactivation revokes the stale member session on the next request", async () => {
  await adminPage.goto(`/portal/${JUNTO_P.slug}/admin`);
  await adminPage
    .getByRole("button", { name: "Deactivate c22-t08-invitee" })
    .click();
  await expect(adminPage.getByRole("status")).toContainText(
    "Private access is revoked immediately",
  );

  await memberPage.goto(editPath);
  await expect(memberPage).toHaveURL("/portal");
  await expect(memberPage.getByText(/no active memberships/i)).toBeVisible();
  expect(
    (
      await restAsUser(
        memberToken,
        `/rest/v1/essays?id=eq.${essayId}&select=id,title,body_markdown`,
      )
    ).json,
  ).toEqual([]);

  // Historical public authorship is not erased by membership removal.
  await anonymousPage.goto(`/essays/${ESSAY_SLUG}`);
  await expect(
    anonymousPage.getByRole("heading", { level: 1, name: ESSAY_TITLE }),
  ).toBeVisible();
});
