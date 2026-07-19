import { expect, test } from "@playwright/test";

// Baseline portal behavior WITHOUT a Supabase stack: every private portal
// path must deny unauthenticated access by redirecting to the sign-in page,
// and the sign-in page itself must follow the writing-room design language.
// The authenticated journeys live in e2e/live (pnpm test:e2e:live).
test.describe("member portal entry (unauthenticated baseline)", () => {
  test("redirects unauthenticated /portal to the sign-in page", async ({
    page,
  }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL("/portal/sign-in");
    await expect(page).toHaveTitle(/Sign in/);
  });

  test("redirects private Junto portal paths without leaking chapter data", async ({
    page,
  }) => {
    for (const path of [
      "/portal/philadelphia",
      "/portal/philadelphia/members",
      "/portal/philadelphia/admin",
      "/portal/philadelphia/meetings",
      "/portal/philadelphia/meetings/new",
      "/portal/philadelphia/meetings/00000000-0000-4000-a000-000000000001",
      "/portal/philadelphia/meetings/00000000-0000-4000-a000-000000000001/edit",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/portal\/sign-in/);
      await expect(page.getByText("Philadelphia")).toHaveCount(0);
    }
  });

  test("sign-in page keeps the JUNTO identity and members-only language", async ({
    page,
  }) => {
    await page.goto("/portal/sign-in");
    await expect(page.getByRole("link", { name: "JUNTO" })).toBeVisible();
    // Explicit privacy language, never a bare "Private"
    // (AGENTS.md, "UI and content standards").
    await expect(page.getByText("Junto members only").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Email me a sign-in link" }),
    ).toBeVisible();
  });

  test("sign-in page is excluded from search indexing", async ({ page }) => {
    await page.goto("/portal/sign-in");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("keyboard focus stays visible on the sign-in page", async ({ page }) => {
    await page.goto("/portal/sign-in");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    const focusRing = await skipLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(focusRing.style).toBe("solid");
    expect(parseFloat(focusRing.width)).toBeGreaterThan(0);
  });

  test("sign-in controls are comfortable touch targets on mobile", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "touch-target check applies to the mobile project");
    await page.goto("/portal/sign-in");
    for (const locator of [
      page.getByLabel("Email address"),
      page.getByRole("button", { name: "Email me a sign-in link" }),
    ]) {
      const box = await locator.boundingBox();
      expect(box, "control should be visible").not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("sign-in page renders without horizontal overflow", async ({ page }) => {
    await page.goto("/portal/sign-in");
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
