import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";

import {
  CHAPTER_BOOTSTRAP,
  INTEGRATED_MEMBER_EMAIL,
  JUNTO_A,
  JUNTO_B,
  JUNTO_C,
  MEMBER_EMAIL,
  UNINVITED_EMAIL,
  adminUsersByEmail,
  chapterRecordBySlug,
  claimedInvitationCount,
  cleanupFixtures,
  clearMailbox,
  deactivateMembership,
  latestAuthLinkFor,
  membershipCountForFixtureJuntos,
  resetFixtures,
  restAsUser,
  verifyFixturesAbsent,
} from "./fixtures";
import {
  closeBrowserContextsExhaustively,
  runExhaustiveLiveTeardown,
} from "./exhaustive-teardown";

// These journeys drive the REAL local Supabase Auth (GoTrue), PostgREST, and
// Mailpit stack through the production-built application: invitation-gated
// magic-link entry, invitation claiming, multi-Junto switching, Junto-scoped
// admin navigation, live deactivation, and safe denials.
//
// The journey is ONE ordered story — sign in, claim, switch, deactivate,
// sign out — so the file runs serially with a single shared page whose
// cookies (the member's real session) persist across tests. Each Playwright
// project (desktop/mobile) gets a fresh worker, context, and re-seeded
// fixtures, so the full journey is proven on both form factors.
test.describe.configure({ mode: "serial" });

let context: BrowserContext | null = null;
let memberClaimContext: BrowserContext | null = null;
let adminClaimContext: BrowserContext | null = null;
let page: Page;
let isMobile: boolean;
let appOrigin: string;

async function requestSignInLink(page: Page, email: string): Promise<void> {
  await page.goto("/portal/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function configuredContext(
  browser: Browser,
  testInfo: TestInfo,
): Promise<BrowserContext> {
  const use = testInfo.project.use;
  return browser.newContext({
    baseURL: use.baseURL,
    viewport: use.viewport,
    userAgent: use.userAgent,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
  });
}

async function accessToken(browserContext: BrowserContext): Promise<string> {
  const raw = decodeURIComponent(
    (await browserContext.cookies())
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
  if (!session.access_token) throw new Error("session carries no access token");
  return session.access_token;
}

async function claimInvitation(
  claimPage: Page,
  email: string,
  expectedLanding: string,
): Promise<void> {
  await clearMailbox();
  await requestSignInLink(claimPage, email);
  await expect(claimPage.getByText(/check your email/i).first()).toBeVisible();
  await claimPage.goto(await latestAuthLinkFor(email));
  await expect(claimPage).toHaveURL(expectedLanding);
}

test.beforeAll(async ({ browser }, testInfo) => {
  await resetFixtures();
  // The shared context must carry the project's device emulation and
  // baseURL; only the relevant, explicitly chosen options are forwarded.
  const use = testInfo.project.use;
  isMobile = use.isMobile ?? false;
  appOrigin = String(use.baseURL);
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
      await closeBrowserContextsExhaustively(
        [context, memberClaimContext, adminClaimContext].filter(
          (candidate): candidate is BrowserContext => candidate !== null,
        ),
      );
    },
    cleanupFixtures,
    verifyFixturesAbsent,
  });
});

test("unauthenticated portal access is denied without leaking chapter data", async () => {
  await page.goto("/portal");
  await expect(page).toHaveURL("/portal/sign-in");
  for (const path of [
    `/portal/${JUNTO_A.slug}`,
    `/portal/${JUNTO_A.slug}/members`,
    `/portal/${JUNTO_A.slug}/admin`,
    `/portal/${JUNTO_C.slug}`,
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/portal\/sign-in/);
    for (const name of [JUNTO_A.name, JUNTO_B.name, JUNTO_C.name]) {
      await expect(page.getByText(name)).toHaveCount(0);
    }
  }
});

test("sign-in page operates by keyboard with visible focus", async () => {
  await page.goto("/portal/sign-in");
  await expect(page.getByText("Junto members only").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const email = page.getByLabel("Email address");
  await email.focus();
  const focusRing = await email.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focusRing.style).toBe("solid");
  expect(parseFloat(focusRing.width)).toBeGreaterThan(0);
});

test("an uninvited address receives a safe invitation-only rejection", async () => {
  await clearMailbox();
  await requestSignInLink(page, UNINVITED_EMAIL);
  await expect(page.getByText(/by invitation/i).first()).toBeVisible();
  await expect(page.getByText(/check your email/i)).toHaveCount(0);
  // No auth user, hence no session, profile, or membership can exist.
  expect(await adminUsersByEmail(UNINVITED_EMAIL)).toHaveLength(0);
  expect(await membershipCountForFixtureJuntos()).toBe(0);
  await page.goto("/portal");
  await expect(page).toHaveURL("/portal/sign-in");
});

test("an invited address activates through the real mailbox and enters the correct portal", async () => {
  await clearMailbox();
  await requestSignInLink(page, MEMBER_EMAIL);
  await expect(page.getByText(/check your email/i).first()).toBeVisible();

  // Open the actual emailed Supabase verification link, exactly as a member
  // would; GoTrue verifies the token and redirects into /auth/callback.
  const link = await latestAuthLinkFor(MEMBER_EMAIL);
  const response = await page.goto(link);
  await expect(page).toHaveURL("/portal");

  // Both invitations were claimed under the verified session.
  expect(await claimedInvitationCount()).toBe(2);
  expect(await membershipCountForFixtureJuntos()).toBe(2);

  // The private response is non-cacheable and out of search indexes.
  expect(response?.headers()["cache-control"] ?? "").toContain("no-store");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    "content",
    /noindex/,
  );

  // Two active memberships: the entry route offers both chapters.
  await expect(page.getByRole("link", { name: JUNTO_A.name })).toBeVisible();
  await expect(page.getByRole("link", { name: JUNTO_B.name })).toBeVisible();
  await expect(page.getByText(JUNTO_C.name)).toHaveCount(0);

  await page.getByRole("link", { name: JUNTO_A.name }).click();
  await expect(page).toHaveURL(`/portal/${JUNTO_A.slug}`);

  // The selected Junto's shell: identity, members-only language, role, nav.
  await expect(page.getByRole("link", { name: "JUNTO" })).toBeVisible();
  await expect(page.getByText("Junto members only").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: JUNTO_A.name }),
  ).toBeVisible();
  await expect(
    page.getByText("You are an admin of this Junto.").first(),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Portal" });
  for (const label of [
    "Home",
    "Meetings",
    "Essays",
    "Members",
    "Profile",
    "Admin",
  ]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Chat" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  if (isMobile) {
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box, "portal navigation link should be visible").not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("protected sections stay protected and never fabricate data", async () => {
  await page.goto(`/portal/${JUNTO_A.slug}/members`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Members" }),
  ).toBeVisible();
  // The roster shows the real claimed profile, not invented members.
  await expect(page.getByText("c07-t03-member").first()).toBeVisible();

  await page.goto(`/portal/${JUNTO_A.slug}/meetings`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Meetings" }),
  ).toBeVisible();
  await expect(page.getByText(/no meetings? .* yet/i).first()).toBeVisible();

  await page.goto(`/portal/${JUNTO_A.slug}/essays`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Essays" }),
  ).toBeVisible();
});

test("switching Juntos applies only that membership's role and navigation", async () => {
  await page.goto(`/portal/${JUNTO_A.slug}`);
  const switcher = page.getByRole("navigation", { name: "Your Juntos" });
  await expect(
    switcher.getByRole("link", { name: JUNTO_B.name }),
  ).toBeVisible();
  await switcher.getByRole("link", { name: JUNTO_B.name }).click();
  await expect(page).toHaveURL(`/portal/${JUNTO_B.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: JUNTO_B.name }),
  ).toBeVisible();
  await expect(
    page.getByText("You are a member of this Junto.").first(),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Portal" });
  await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
  // Admin authority in Junto A grants nothing in Junto B.
  await expect(nav.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("admin routes are denied outside the admin's own Junto", async () => {
  await page.goto(`/portal/${JUNTO_B.slug}/admin`);
  await expect(page).toHaveURL(`/portal/${JUNTO_B.slug}`);
  await page.goto(`/portal/${JUNTO_A.slug}/admin`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin" }),
  ).toBeVisible();
});

test("cross-Junto direct URLs are denied without leaking private names", async () => {
  for (const slug of [JUNTO_C.slug, "junto-that-does-not-exist"]) {
    await page.goto(`/portal/${slug}`);
    // Same safe outcome whether or not the Junto exists.
    await expect(page).toHaveURL("/portal");
    await expect(page.getByText(JUNTO_C.name)).toHaveCount(0);
  }
});

test("an authenticated session survives a reload", async () => {
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: JUNTO_A.name }),
  ).toBeVisible();
});

test("an existing admin creates, switches, configures, invites, and grants only invitation-backed chapter access", async ({
  browser,
}, testInfo) => {
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await page.getByRole("link", { name: "Create chapter" }).click();
  await expect(page).toHaveURL("/portal/chapters/new");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create a chapter" }),
  ).toBeVisible();
  await expect(page.locator("main#main-content")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toHaveAttribute("href", "#main-content");
  await expect(page.getByRole("link", { name: "JUNTO" })).toBeVisible();
  await expect(page.getByText("Junto members only").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("Chapter name").fill(CHAPTER_BOOTSTRAP.name);
  await page.getByLabel("Chapter URL").fill(CHAPTER_BOOTSTRAP.slug);
  await page.getByLabel("Description").fill("A chapter created through T01.");
  await page.getByLabel("Location").fill("Maple Room");
  await expect(page.getByLabel("Archive visibility")).toHaveValue("private");
  if (isMobile) {
    const submitBox = await page
      .getByRole("button", { name: "Create chapter" })
      .boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "Create chapter" }).click();
  await expect(page).toHaveURL(
    `/portal/${CHAPTER_BOOTSTRAP.slug}/admin?status=chapter-created`,
  );
  await expect(page.getByText(CHAPTER_BOOTSTRAP.name).first()).toBeVisible();
  await expect(page.getByText(/first admin/i).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const created = await chapterRecordBySlug(CHAPTER_BOOTSTRAP.slug);
  expect(created).toMatchObject({
    name: CHAPTER_BOOTSTRAP.name,
    description: "A chapter created through T01.",
    location: "Maple Room",
    archiveVisibility: "private",
  });
  if (!created) throw new Error("created chapter was not persisted");

  const settings = page.locator("section", {
    has: page.getByRole("heading", { name: "Chapter settings" }),
  });
  await settings.getByLabel("Chapter name").fill("T01 Maple Table");
  await settings
    .getByLabel("Description")
    .fill("A bounded selected-chapter setting.");
  await settings.getByLabel("Location").fill("Center City");
  await settings.getByLabel("Archive visibility").selectOption("public");
  await settings.getByRole("button", { name: "Save chapter settings" }).click();
  await expect(page).toHaveURL(
    `/portal/${CHAPTER_BOOTSTRAP.slug}/admin?status=settings-saved`,
  );
  expect(await chapterRecordBySlug(CHAPTER_BOOTSTRAP.slug)).toMatchObject({
    name: "T01 Maple Table",
    description: "A bounded selected-chapter setting.",
    location: "Center City",
    archiveVisibility: "public",
  });

  // The write was scoped to Maple: Alder's selected settings remain intact.
  await page.goto(`/portal/${JUNTO_A.slug}/admin`);
  const alderSettings = page.locator("section", {
    has: page.getByRole("heading", { name: "Chapter settings" }),
  });
  await expect(alderSettings.getByLabel("Chapter name")).toHaveValue(
    JUNTO_A.name,
  );
  await expect(alderSettings.getByLabel("Archive visibility")).toHaveValue(
    "private",
  );

  await page.goto(`/portal/${CHAPTER_BOOTSTRAP.slug}/admin`);
  const invitations = page.locator("section", {
    has: page.getByRole("heading", { name: "Invitations" }),
  });
  const invitationForm = invitations.locator("form");

  await invitationForm
    .getByLabel("Email address")
    .fill(INTEGRATED_MEMBER_EMAIL);
  await invitationForm
    .getByLabel("Role", { exact: true })
    .selectOption("member");
  await invitationForm.getByRole("checkbox").check();
  await invitationForm.getByRole("button", { name: "Invite a member" }).click();
  await expect(page.getByText(INTEGRATED_MEMBER_EMAIL)).toBeVisible();

  await invitationForm.getByLabel("Email address").fill(UNINVITED_EMAIL);
  await invitationForm
    .getByLabel("Role", { exact: true })
    .selectOption("admin");
  await invitationForm.getByRole("checkbox").check();
  await invitationForm.getByRole("button", { name: "Invite a member" }).click();
  await expect(page.getByText(UNINVITED_EMAIL)).toBeVisible();

  memberClaimContext = await configuredContext(browser, testInfo);
  const memberPage = await memberClaimContext.newPage();
  await claimInvitation(
    memberPage,
    INTEGRATED_MEMBER_EMAIL,
    `/portal/${CHAPTER_BOOTSTRAP.slug}`,
  );
  await expect(memberPage.getByText("T01 Maple Table").first()).toBeVisible();
  await expect(
    memberPage.getByRole("navigation", { name: "Portal" }).getByText("Admin"),
  ).toHaveCount(0);
  for (const privateName of [JUNTO_A.name, JUNTO_B.name, JUNTO_C.name]) {
    await expect(memberPage.getByText(privateName)).toHaveCount(0);
  }
  await memberPage.goto(`/portal/${CHAPTER_BOOTSTRAP.slug}/admin`);
  await expect(memberPage).toHaveURL(`/portal/${CHAPTER_BOOTSTRAP.slug}`);

  const memberToken = await accessToken(memberClaimContext);
  const forbiddenSettings = await restAsUser(
    memberToken,
    `/rest/v1/juntos?id=eq.${created.id}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { name: "Member hijack" },
    },
  );
  expect(forbiddenSettings.status).toBeLessThan(300);
  expect(forbiddenSettings.json).toEqual([]);
  const forbiddenBootstrap = await restAsUser(
    memberToken,
    "/rest/v1/rpc/bootstrap_junto",
    {
      method: "POST",
      body: { chapter_name: "Member attempt", chapter_slug: "member-attempt" },
    },
  );
  expect(forbiddenBootstrap.status).toBe(403);

  adminClaimContext = await configuredContext(browser, testInfo);
  const adminPage = await adminClaimContext.newPage();
  await claimInvitation(
    adminPage,
    UNINVITED_EMAIL,
    `/portal/${CHAPTER_BOOTSTRAP.slug}`,
  );
  await expect(
    adminPage
      .getByRole("navigation", { name: "Portal" })
      .getByRole("link", { name: "Admin" }),
  ).toBeVisible();
  await adminPage.goto(`/portal/${JUNTO_A.slug}/admin`);
  await expect(adminPage).toHaveURL(`/portal/${CHAPTER_BOOTSTRAP.slug}`);
  await expect(adminPage.getByText(JUNTO_A.name)).toHaveCount(0);

  const adminToken = await accessToken(adminClaimContext);
  const crossChapterPatch = await restAsUser(
    adminToken,
    `/rest/v1/juntos?id=eq.${JUNTO_A.id}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { name: "Cross-chapter hijack" },
    },
  );
  expect(crossChapterPatch.status).toBeLessThan(300);
  expect(crossChapterPatch.json).toEqual([]);

  await expectNoHorizontalOverflow(memberPage);
  await expectNoHorizontalOverflow(adminPage);

  // Restore the original story's two memberships while leaving the created
  // chapter and invitation-backed claimants for exhaustive teardown.
  await deactivateMembership(created.id, MEMBER_EMAIL);
});

test("deactivation denies the portal on the very next request", async () => {
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await expect(
    page.getByRole("heading", { level: 1, name: JUNTO_A.name }),
  ).toBeVisible();

  await deactivateMembership(JUNTO_A.id, MEMBER_EMAIL);

  // The Auth session is still valid, but the reload is denied immediately
  // and lands on the remaining active membership.
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await expect(page).toHaveURL(`/portal/${JUNTO_B.slug}`);
  await expect(page.getByText(JUNTO_A.name)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: JUNTO_B.name }),
  ).toBeVisible();
});

test("sign-out ends portal access", async () => {
  await page.goto(`/portal/${JUNTO_B.slug}`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/portal\/sign-in/);
  await expect(page.getByText(/signed out/i).first()).toBeVisible();
  await page.goto(`/portal/${JUNTO_B.slug}`);
  await expect(page).toHaveURL(/\/portal\/sign-in/);
});

test("unsafe next destinations cannot redirect outside the application", async () => {
  // A crafted external next on the sign-in entry must not survive the flow.
  await clearMailbox();
  await page.goto("/portal/sign-in?next=https%3A%2F%2Fevil.example%2Fphish");
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/check your email/i).first()).toBeVisible();
  const link = await latestAuthLinkFor(MEMBER_EMAIL);
  await page.goto(link);
  expect(page.url().startsWith(appOrigin)).toBe(true);
  // Only one active membership remains, so entry lands directly in it.
  await expect(page).toHaveURL(`/portal/${JUNTO_B.slug}`);

  // A crafted callback with a protocol-relative next and a bogus code stays
  // local and reports a safe link error.
  await page.goto("/auth/callback?code=bogus-code&next=%2F%2Fevil.example");
  expect(page.url().startsWith(appOrigin)).toBe(true);
  await expect(page).toHaveURL(/\/portal\/sign-in/);
  await expect(page.getByText(/sign-in link/i).first()).toBeVisible();
});

test("losing the last active membership yields a safe empty portal", async () => {
  await deactivateMembership(JUNTO_B.id, MEMBER_EMAIL);
  await page.goto("/portal");
  await expect(page).toHaveURL("/portal");
  await expect(page.getByText(/no active memberships/i).first()).toBeVisible();
  for (const name of [JUNTO_A.name, JUNTO_B.name, JUNTO_C.name]) {
    await expect(page.getByText(name)).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/portal\/sign-in/);
});
