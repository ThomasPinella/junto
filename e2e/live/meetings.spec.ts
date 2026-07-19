import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import {
  JUNTO_A,
  JUNTO_B,
  JUNTO_C,
  JUNTO_P,
  JUNTO_Q,
  MEETING_C_PRIVATE,
  MEETING_P_ARCHIVED,
  MEETING_P_CANCELLED,
  MEETING_P_COMPLETED,
  MEETING_P_UPCOMING,
  MEETING_Q_INACTIVE,
  MEMBER_EMAIL,
  PRIVATE_LOCATION_MARKER,
  cleanupFixtures,
  clearMailbox,
  deactivateMembership,
  latestAuthLinkFor,
  resetFixtures,
  restAsUser,
  verifyFixturesAbsent,
} from "./fixtures";

// T04 meetings journeys against the real local Supabase stack through the
// production build: the safe public meeting archive, uniform non-disclosure
// for private/inactive/nonexistent chapters, the member/admin meeting
// program, the full admin lifecycle including deliberate reversible
// archiving, Junto-scoped denial of mutations at the API layer with a real
// session token (never service role, never fabricated auth state), and
// deactivation revoking access on the next request.
//
// One ordered story per project (desktop/mobile), like member-entry.spec.ts:
// serial mode, one shared page whose real session cookies persist.
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;
let isMobile: boolean;

// Captured when the admin creates Alder's meeting through the UI.
let alderMeetingId: string;
let alderMeetingDate: string;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectVisibleFocus(
  page: Page,
  locator: ReturnType<Page["getByLabel"]>,
): Promise<void> {
  await locator.focus();
  const focusRing = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focusRing.style).toBe("solid");
  expect(parseFloat(focusRing.width)).toBeGreaterThan(0);
}

// No public response may carry the planted private markers, the private
// chapters' names, or the fixture member identity (meeting creator).
async function expectSafePublicBody(page: Page): Promise<void> {
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain(PRIVATE_LOCATION_MARKER.toLowerCase());
  expect(body).not.toContain("deadline");
  expect(body).not.toContain("c07-t03-member");
  for (const name of [JUNTO_A.name, JUNTO_B.name, JUNTO_C.name, JUNTO_Q.name]) {
    expect(body).not.toContain(name.toLowerCase());
  }
}

// The member's real Supabase session access token, read from the browser
// context's auth cookies (possibly chunked and base64-prefixed). This is the
// user's own credential — exactly what PostgREST authorizes — never a
// service key and never injected state.
async function memberAccessToken(): Promise<string> {
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

test.beforeAll(async ({ browser }, testInfo) => {
  await resetFixtures();
  const use = testInfo.project.use;
  isMobile = use.isMobile ?? false;
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
  const teardownErrors: string[] = [];
  try {
    await cleanupFixtures();
  } catch (err) {
    teardownErrors.push(err instanceof Error ? err.message : String(err));
  }
  try {
    await verifyFixturesAbsent();
  } catch (err) {
    teardownErrors.push(err instanceof Error ? err.message : String(err));
  }
  if (teardownErrors.length > 0) {
    throw new Error(`teardown failed — ${teardownErrors.join("; ")}`);
  }
});

test("the public archive lists the public chapter's record with honest statuses and safe fields", async () => {
  await page.goto("/meetings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Meetings" }),
  ).toBeVisible();
  await expect(page.getByText(JUNTO_P.name).first()).toBeVisible();

  // Every lifecycle status is present and labeled honestly.
  await expect(
    page.getByRole("link", { name: MEETING_P_UPCOMING.title! }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: MEETING_P_COMPLETED.title! }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: MEETING_P_CANCELLED.title! }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: MEETING_P_ARCHIVED.title! }),
  ).toBeVisible();
  for (const label of ["Upcoming", "Completed", "Cancelled", "Archived"]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  await expectSafePublicBody(page);
  await expectNoHorizontalOverflow(page);
  if (isMobile) {
    for (const link of await page
      .getByRole("link", { name: /The century ahead|On beginnings/ })
      .all()) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("the public meeting record page renders safe fields at the documented URL", async () => {
  await page.getByRole("link", { name: MEETING_P_COMPLETED.title! }).click();
  await expect(page).toHaveURL(
    `/juntos/${JUNTO_P.slug}/meetings/${MEETING_P_COMPLETED.date}`,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: MEETING_P_COMPLETED.title! }),
  ).toBeVisible();
  await expect(page.getByText("Completed").first()).toBeVisible();
  await expect(
    page.getByText(MEETING_P_COMPLETED.description!).first(),
  ).toBeVisible();
  // Semantic time element carries the machine-readable date.
  await expect(
    page.locator(`time[datetime="${MEETING_P_COMPLETED.date}"]`).first(),
  ).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(JUNTO_P.name));
  await expectSafePublicBody(page);
  await expectNoHorizontalOverflow(page);

  // The archived record's page also remains addressable.
  await page.goto(
    `/juntos/${JUNTO_P.slug}/meetings/${MEETING_P_ARCHIVED.date}`,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: MEETING_P_ARCHIVED.title! }),
  ).toBeVisible();
  await expect(page.getByText(/archived record/i).first()).toBeVisible();
  await expectSafePublicBody(page);
});

test("private, inactive, and nonexistent chapters or dates yield one uniform non-disclosing miss", async () => {
  const misses = [
    // A real meeting of a private chapter.
    `/juntos/${JUNTO_C.slug}/meetings/${MEETING_C_PRIVATE.date}`,
    // A real meeting of an inactive chapter flagged public.
    `/juntos/${JUNTO_Q.slug}/meetings/${MEETING_Q_INACTIVE.date}`,
    // A chapter that has never existed.
    "/juntos/junto-that-does-not-exist/meetings/2026-01-01",
    // A public chapter, but no meeting on that date.
    `/juntos/${JUNTO_P.slug}/meetings/2031-12-31`,
    // A malformed date.
    `/juntos/${JUNTO_P.slug}/meetings/not-a-date`,
  ];
  const outcomes = new Set<string>();
  for (const path of misses) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toContain(JUNTO_C.name);
    expect(body).not.toContain(JUNTO_Q.name);
    expect(body).not.toContain(MEETING_C_PRIVATE.title!);
    expect(body).not.toContain(MEETING_Q_INACTIVE.title!);
    expect(body.toLowerCase()).not.toContain(
      PRIVATE_LOCATION_MARKER.toLowerCase(),
    );
    outcomes.add(await page.getByRole("heading", { level: 1 }).innerText());
  }
  // Every miss reads identically — nothing distinguishes private from absent.
  expect(outcomes.size).toBe(1);
});

test("the invited admin signs in through the real mailbox", async () => {
  await clearMailbox();
  await page.goto("/portal/sign-in");
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(/check your email/i).first()).toBeVisible();
  const link = await latestAuthLinkFor(MEMBER_EMAIL);
  await page.goto(link);
  await expect(page).toHaveURL("/portal");
  await page.getByRole("link", { name: JUNTO_A.name }).click();
  await expect(page).toHaveURL(`/portal/${JUNTO_A.slug}`);
});

test("the chapter opens with an honest empty meeting program", async () => {
  await expect(page.getByText("No meeting is scheduled yet.")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Portal" })
    .getByRole("link", { name: "Meetings" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Meetings" }),
  ).toBeVisible();
  await expect(
    page.getByText("No meetings are scheduled yet.").first(),
  ).toBeVisible();
  // Admin entry point is present for the chapter's own admin.
  await expect(
    page.getByRole("link", { name: "Schedule a meeting" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the admin schedules a meeting through the UI with full details", async () => {
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 30);
  alderMeetingDate = future.toISOString().slice(0, 10);
  const deadline = new Date();
  deadline.setUTCDate(deadline.getUTCDate() + 27);
  const deadlineValue = `${deadline.toISOString().slice(0, 10)}T18:00`;

  await page.getByRole("link", { name: "Schedule a meeting" }).click();
  await expect(page).toHaveURL(`/portal/${JUNTO_A.slug}/meetings/new`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Schedule a meeting" }),
  ).toBeVisible();

  await expectVisibleFocus(page, page.getByLabel("Meeting date"));
  await page.getByLabel("Meeting date").fill(alderMeetingDate);
  await page.getByLabel("Title").fill("What do we owe the future?");
  await page.getByLabel("Theme").fill("Obligation");
  await page
    .getByLabel("Description")
    .fill("Essays on duty across time, read around the table.");
  await page.getByLabel("Location").fill("The Alder parlor, upstairs");
  await page.getByLabel("Essay deadline").fill(deadlineValue);
  if (isMobile) {
    for (const control of [
      page.getByLabel("Meeting date"),
      page.getByRole("button", { name: "Schedule meeting" }),
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole("button", { name: "Schedule meeting" }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/portal/${JUNTO_A.slug}/meetings/[0-9a-f-]{36}\\?status=created`,
    ),
  );
  const capturedId = page.url().match(/\/meetings\/([0-9a-f-]{36})/)?.[1];
  if (!capturedId) {
    throw new Error("meeting id missing from the detail URL");
  }
  alderMeetingId = capturedId;

  await expect(page.getByText("Meeting scheduled.")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What do we owe the future?",
    }),
  ).toBeVisible();
  // Members see the full authorized details.
  await expect(page.getByText("The Alder parlor, upstairs")).toBeVisible();
  await expect(page.getByText("Essay deadline", { exact: true })).toBeVisible();
  await expect(page.getByText("Upcoming", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the new meeting is the portal home's next meeting and leads the program", async () => {
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await expect(page.getByText("What do we owe the future?")).toBeVisible();
  await expect(page.getByText(/essay deadline/i).first()).toBeVisible();
  await page.getByRole("link", { name: "Meeting details" }).click();
  await expect(page).toHaveURL(
    `/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}`,
  );

  await page.goto(`/portal/${JUNTO_A.slug}/meetings`);
  const upcoming = page.locator("section", {
    has: page.getByRole("heading", { name: "Upcoming" }),
  });
  await expect(
    upcoming.getByRole("link", { name: "What do we owe the future?" }),
  ).toBeVisible();
});

test("the admin edits details and moves the meeting through its lifecycle", async () => {
  await page.goto(`/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}/edit`);
  await page.getByLabel("Title").fill("What do we owe the future? (revised)");
  await page.getByLabel("Location").fill("The back room at Fergie's");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(
    `/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}?status=updated`,
  );
  await expect(page.getByText("Meeting details saved.")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What do we owe the future? (revised)",
    }),
  ).toBeVisible();
  await expect(page.getByText("The back room at Fergie's")).toBeVisible();

  // Completed: it leaves the upcoming program immediately.
  await page.getByRole("link", { name: "Edit meeting" }).click();
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByText("Meeting marked completed.")).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await expect(page.getByText("No meeting is scheduled yet.")).toBeVisible();

  // Reopened: it returns as the next meeting.
  await page.goto(`/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}/edit`);
  await page.getByRole("button", { name: "Reopen as upcoming" }).click();
  await expect(page.getByText("Meeting reopened as upcoming.")).toBeVisible();
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await expect(
    page.getByText("What do we owe the future? (revised)"),
  ).toBeVisible();
});

test("archiving is deliberate, reversible history — never a delete", async () => {
  await page.goto(`/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}/edit`);
  const confirm = page.getByLabel(/I understand this meeting will leave/);
  // The archive action demands its explicit confirmation control.
  await expect(confirm).toHaveAttribute("required", "");
  await confirm.check();
  await page.getByRole("button", { name: "Archive meeting" }).click();
  await expect(page).toHaveURL(
    `/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}?status=archived`,
  );
  await expect(page.getByText(/meeting archived/i).first()).toBeVisible();

  // Gone from upcoming/next…
  await page.goto(`/portal/${JUNTO_A.slug}`);
  await expect(page.getByText("No meeting is scheduled yet.")).toBeVisible();
  await page.goto(`/portal/${JUNTO_A.slug}/meetings`);
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: "Past & records" }),
  });
  await expect(
    history.getByRole("link", {
      name: "What do we owe the future? (revised)",
    }),
  ).toBeVisible();
  await expect(history.getByText("Archived").first()).toBeVisible();

  // …while the record itself stays intact for members.
  await page.goto(`/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What do we owe the future? (revised)",
    }),
  ).toBeVisible();
  await expect(page.getByText("The back room at Fergie's")).toBeVisible();
});

test("meeting mutations are denied per Junto at the API layer with the member's real token", async () => {
  const token = await memberAccessToken();

  // Ordinary member of Birch: cannot create a meeting there.
  const insertB = await restAsUser(token, "/rest/v1/meetings", {
    method: "POST",
    prefer: "return=minimal",
    body: { junto_id: JUNTO_B.id, meeting_date: "2031-01-01" },
  });
  expect(insertB.status).toBe(403);

  // Admin of Alder: authority confers nothing in Cedar.
  const insertC = await restAsUser(token, "/rest/v1/meetings", {
    method: "POST",
    prefer: "return=minimal",
    body: { junto_id: JUNTO_C.id, meeting_date: "2031-01-02" },
  });
  expect(insertC.status).toBe(403);

  // Cross-Junto update: RLS yields zero affected rows, never a change.
  const patchC = await restAsUser(
    token,
    `/rest/v1/meetings?id=eq.${MEETING_C_PRIVATE.id}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { title: "hijacked" },
    },
  );
  expect(patchC.status).toBeLessThan(300);
  expect(patchC.json).toEqual([]);

  // Moving the admin's own meeting to another Junto is impossible.
  const movePatch = await restAsUser(
    token,
    `/rest/v1/meetings?id=eq.${alderMeetingId}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { junto_id: JUNTO_C.id },
    },
  );
  expect(movePatch.status).toBe(403);

  // No DELETE exists for anyone — not even the Junto's own admin.
  const deleteAttempt = await restAsUser(
    token,
    `/rest/v1/meetings?id=eq.${alderMeetingId}`,
    { method: "DELETE", prefer: "return=minimal" },
  );
  expect(deleteAttempt.status).toBe(403);
});

test("an ordinary member sees no admin controls and cannot reach admin routes", async () => {
  // The same person is only a member in Birch.
  await page.goto(`/portal/${JUNTO_B.slug}/meetings`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Meetings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Schedule a meeting" }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  // Direct admin route: response-specific denial back to the chapter home.
  await page.goto(`/portal/${JUNTO_B.slug}/meetings/new`);
  await expect(page).toHaveURL(`/portal/${JUNTO_B.slug}`);
});

test("cross-Junto private URLs deny without leaking the other chapter", async () => {
  // A private chapter the member does not belong to.
  await page.goto(`/portal/${JUNTO_C.slug}/meetings`);
  await expect(page).toHaveURL("/portal");
  await expect(page.getByText(JUNTO_C.name)).toHaveCount(0);

  // A Cedar meeting id under the Alder slug: junto-scoped lookup misses.
  await page.goto(`/portal/${JUNTO_A.slug}/meetings/${MEETING_C_PRIVATE.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
  await expect(page.getByText(MEETING_C_PRIVATE.title!)).toHaveCount(0);

  // The private chapter's meeting never has a public page.
  await page.goto(`/juntos/${JUNTO_A.slug}/meetings/${alderMeetingDate}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
  await expect(
    page.getByText("What do we owe the future? (revised)"),
  ).toHaveCount(0);
});

test("deactivation revokes meeting access on the very next request", async () => {
  await deactivateMembership(JUNTO_A.id, MEMBER_EMAIL);
  await page.goto(`/portal/${JUNTO_A.slug}/meetings/${alderMeetingId}`);
  // The lone remaining active membership (Birch) is the safe landing.
  await expect(page).toHaveURL(`/portal/${JUNTO_B.slug}`);
  await expect(
    page.getByText("What do we owe the future? (revised)"),
  ).toHaveCount(0);
  await expect(page.getByText(JUNTO_A.name)).toHaveCount(0);
});

test("public surfaces stay keyboard-operable and sign-out ends the session", async () => {
  await page.goto("/meetings");
  const firstRecord = page.getByRole("link", {
    name: MEETING_P_UPCOMING.title!,
  });
  await expectVisibleFocus(page, firstRecord);
  await page.goto(`/portal/${JUNTO_B.slug}`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/portal\/sign-in/);
  await page.goto(`/portal/${JUNTO_B.slug}/meetings`);
  await expect(page).toHaveURL(/\/portal\/sign-in/);
});
