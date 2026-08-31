import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";

import {
  CHAPTER_APPLICATION_APPROVE_EMAIL,
  CHAPTER_APPLICATION_APPROVED,
  CHAPTER_APPLICATION_DECLINE_EMAIL,
  CHAPTER_APPLICATION_REVIEWER_EMAIL,
  JUNTO_A,
  MEMBER_EMAIL,
  applicationRecordByEmail,
  chapterRecordBySlug,
  cleanupFixtures,
  clearMailbox,
  invitationRecordByEmail,
  latestAuthLinkFor,
  resetFixtures,
  verifyFixturesAbsent,
} from "./fixtures";
import {
  closeBrowserContextsExhaustively,
  runExhaustiveLiveTeardown,
} from "./exhaustive-teardown";

test.describe.configure({ mode: "serial" });

let applicantContext: BrowserContext | null = null;
let ordinaryContext: BrowserContext | null = null;
let reviewerContext: BrowserContext | null = null;
let applicantPage: Page;
let isMobile = false;

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

async function requestMagicLink(page: Page, email: string): Promise<void> {
  await clearMailbox();
  await page.goto("/portal/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/check your email/i).first()).toBeVisible();
  await page.goto(await latestAuthLinkFor(email));
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(() =>
      Math.max(
        0,
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ),
  ).toBeLessThanOrEqual(1);
}

test.beforeAll(async ({ browser }, testInfo) => {
  await resetFixtures();
  isMobile = testInfo.project.use.isMobile ?? false;
  applicantContext = await configuredContext(browser, testInfo);
  applicantPage = await applicantContext.newPage();
});

test.afterAll(async () => {
  await runExhaustiveLiveTeardown({
    closeBrowserContext: async () => {
      await closeBrowserContextsExhaustively(
        [applicantContext, ordinaryContext, reviewerContext].filter(
          (candidate): candidate is BrowserContext => candidate !== null,
        ),
      );
    },
    cleanupFixtures,
    verifyFixturesAbsent,
  });
});

test("public submit, exact review, atomic approval, verified admin claim, and decline", async ({
  browser,
}, testInfo) => {
  await applicantPage.goto("/start-a-chapter");
  await expect(
    applicantPage.getByRole("heading", { level: 1, name: "Start a chapter" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(applicantPage);
  await applicantPage
    .getByLabel("Chapter name")
    .fill(CHAPTER_APPLICATION_APPROVED.name);
  await applicantPage.getByLabel("City or location").fill("Hickory, NC");
  await applicantPage
    .getByLabel("Email address")
    .fill(CHAPTER_APPLICATION_APPROVE_EMAIL);
  await applicantPage
    .getByLabel("Why this chapter?")
    .fill("A table for essays about civic life in Hickory.");
  const publicSubmit = applicantPage.getByRole("button", {
    name: "Submit application",
  });
  if (isMobile) {
    expect(
      (await publicSubmit.boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
  }
  await publicSubmit.click();
  await expect(applicantPage).toHaveURL(
    "/start-a-chapter?status=submitted-notification-failed",
  );
  await expect(
    applicantPage.getByText(/application was saved.*notification/i),
  ).toBeVisible();
  expect(
    await applicationRecordByEmail(CHAPTER_APPLICATION_APPROVE_EMAIL),
  ).toMatchObject({
    status: "pending",
    juntoId: null,
    reviewedBy: null,
    reviewedAt: null,
  });

  await applicantPage.goto("/start-a-chapter");
  await applicantPage.getByLabel("Chapter name").fill("T09 Declined Table");
  await applicantPage.getByLabel("City or location").fill("Tacoma, WA");
  await applicantPage
    .getByLabel("Email address")
    .fill(CHAPTER_APPLICATION_DECLINE_EMAIL);
  await applicantPage
    .getByLabel("Why this chapter?")
    .fill("A second bounded application for the durable decline path.");
  await applicantPage
    .getByRole("button", { name: "Submit application" })
    .click();
  await expect(applicantPage).toHaveURL(
    "/start-a-chapter?status=submitted-notification-failed",
  );

  ordinaryContext = await configuredContext(browser, testInfo);
  const ordinaryPage = await ordinaryContext.newPage();
  await requestMagicLink(ordinaryPage, MEMBER_EMAIL);
  await ordinaryPage.goto("/portal/applications");
  await expect(ordinaryPage).toHaveURL("/portal");
  await expect(
    ordinaryPage.getByText(CHAPTER_APPLICATION_APPROVE_EMAIL),
  ).toHaveCount(0);

  reviewerContext = await configuredContext(browser, testInfo);
  const reviewerPage = await reviewerContext.newPage();
  await requestMagicLink(reviewerPage, CHAPTER_APPLICATION_REVIEWER_EMAIL);
  await reviewerPage.goto("/portal/applications");
  await expect(
    reviewerPage.getByRole("heading", {
      level: 1,
      name: "Chapter applications",
    }),
  ).toBeVisible();
  await expect(
    reviewerPage.getByText(CHAPTER_APPLICATION_APPROVE_EMAIL),
  ).toBeVisible();
  await expect(
    reviewerPage.getByText(CHAPTER_APPLICATION_DECLINE_EMAIL),
  ).toBeVisible();
  await expect(
    reviewerPage.getByRole("button", { name: "Sign out" }),
  ).toBeVisible();
  await expect(reviewerPage.locator("main#main-content")).toBeVisible();
  await expectNoHorizontalOverflow(reviewerPage);
  expect(
    await reviewerPage
      .locator("form")
      .evaluateAll((forms) =>
        forms.map((form) =>
          form instanceof HTMLFormElement
            ? form.method.toLowerCase()
            : "invalid",
        ),
      ),
  ).not.toContain("get");
  expect(
    await reviewerPage
      .locator("a")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href") ?? "").join("\n"),
      ),
  ).not.toMatch(/approve|decline|decision=/i);

  const approveRow = reviewerPage.locator("li", {
    has: reviewerPage.getByRole("heading", {
      name: CHAPTER_APPLICATION_APPROVED.name,
    }),
  });
  await expect(approveRow.getByLabel("Chapter URL")).toHaveValue(
    CHAPTER_APPLICATION_APPROVED.slug,
  );
  if (isMobile) {
    for (const control of [
      approveRow.getByLabel("Chapter URL"),
      approveRow.getByRole("button", { name: "Approve application" }),
    ]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
        44,
      );
    }
  }
  await approveRow.getByRole("button", { name: "Approve application" }).click();
  await expect(reviewerPage).toHaveURL(
    "/portal/applications?status=approved-notification-failed",
  );
  await expect(
    reviewerPage.getByText(/approved.*notification could not be delivered/i),
  ).toBeVisible();

  const approvedChapter = await chapterRecordBySlug(
    CHAPTER_APPLICATION_APPROVED.slug,
  );
  expect(approvedChapter).toMatchObject({
    name: CHAPTER_APPLICATION_APPROVED.name,
    location: "Hickory, NC",
    archiveVisibility: "private",
  });
  if (!approvedChapter) throw new Error("approved chapter was not persisted");
  expect(
    await applicationRecordByEmail(CHAPTER_APPLICATION_APPROVE_EMAIL),
  ).toMatchObject({
    status: "approved",
    juntoId: approvedChapter.id,
    reviewedAt: expect.any(String),
    reviewedBy: expect.any(String),
  });
  expect(
    await invitationRecordByEmail(CHAPTER_APPLICATION_APPROVE_EMAIL),
  ).toEqual({
    juntoId: approvedChapter.id,
    role: "admin",
    status: "pending",
  });

  // The original public-submission browser completes the applicant's own
  // mailbox-owned flow. No Auth user is created during approval.
  await requestMagicLink(applicantPage, CHAPTER_APPLICATION_APPROVE_EMAIL);
  await expect(applicantPage).toHaveURL(
    `/portal/${CHAPTER_APPLICATION_APPROVED.slug}`,
  );
  await expect(
    applicantPage.getByRole("heading", {
      level: 1,
      name: CHAPTER_APPLICATION_APPROVED.name,
    }),
  ).toBeVisible();
  await expect(
    applicantPage
      .getByRole("navigation", { name: "Portal" })
      .getByRole("link", { name: "Admin" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(applicantPage);
  expect(
    await invitationRecordByEmail(CHAPTER_APPLICATION_APPROVE_EMAIL),
  ).toMatchObject({
    status: "claimed",
    role: "admin",
    juntoId: approvedChapter.id,
  });

  await reviewerPage.goto("/portal/applications");
  const declineRow = reviewerPage.locator("li", {
    has: reviewerPage.getByRole("heading", { name: "T09 Declined Table" }),
  });
  await declineRow.getByRole("button", { name: "Decline application" }).click();
  await expect(reviewerPage).toHaveURL(
    "/portal/applications?status=declined-notification-failed",
  );
  await expect(
    reviewerPage.getByText(/declined.*notification could not be delivered/i),
  ).toBeVisible();
  expect(
    await applicationRecordByEmail(CHAPTER_APPLICATION_DECLINE_EMAIL),
  ).toMatchObject({
    status: "declined",
    juntoId: null,
    reviewedAt: expect.any(String),
    reviewedBy: expect.any(String),
  });
  expect(
    await invitationRecordByEmail(CHAPTER_APPLICATION_DECLINE_EMAIL),
  ).toBeNull();

  // Reviewer membership is ordinary and unrelated to the approved chapter;
  // the hardcoded reviewer exception never grants chapter administration.
  await reviewerPage.goto(`/portal/${CHAPTER_APPLICATION_APPROVED.slug}/admin`);
  await expect(reviewerPage).toHaveURL(`/portal/${JUNTO_A.slug}`);
});
