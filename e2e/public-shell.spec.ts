import { expect, test } from "@playwright/test";

const publicShells = [
  { label: "Archive", path: "/essays" },
  { label: "Meetings", path: "/meetings" },
  { label: "Authors", path: "/authors" },
  { label: "About", path: "/about" },
  { label: "Member Portal", path: "/portal" },
] as const;

const allShellPaths = ["/", ...publicShells.map((shell) => shell.path)];

test.describe("public publication shell", () => {
  test("serves the configured initial chapter's publication at /", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Junto");
    await expect(page.getByRole("link", { name: "JUNTO" })).toBeVisible();
    // Chapter name derived from JUNTO_INITIAL_JUNTO_SLUG in .env.local.
    await expect(page.getByText("Philadelphia", { exact: true })).toBeVisible();
  });

  test("uses the warm-paper canvas, not a generic dashboard background", async ({
    page,
  }) => {
    await page.goto("/");
    const background = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(background).toBe("rgb(243, 240, 232)");
  });

  for (const shell of publicShells) {
    test(`publication navigation reaches ${shell.path}`, async ({ page }) => {
      await page.goto("/");
      await page
        .getByRole("navigation", { name: "Publication" })
        .getByRole("link", { name: shell.label })
        .click();
      await expect(page).toHaveURL(shell.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("keyboard reaches the skip link first, with a visible focus indicator", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    const focusRing = await skipLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(focusRing.style).toBe("solid");
    expect(parseFloat(focusRing.width)).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("publication navigation shows visible keyboard focus", async ({
    page,
  }) => {
    await page.goto("/");
    // Tab order: skip link → wordmark → first navigation link.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) {
        return null;
      }
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        text: element.textContent,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    expect(focused?.tag).toBe("A");
    expect(focused?.text).toBe("Archive");
    expect(focused?.outlineStyle).toBe("solid");
    expect(parseFloat(focused?.outlineWidth ?? "0")).toBeGreaterThan(0);
  });

  for (const path of allShellPaths) {
    test(`${path} renders without horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("navigation links are comfortable touch targets on mobile", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "touch-target check applies to the mobile project");
    await page.goto("/");
    const links = await page
      .getByRole("navigation", { name: "Publication" })
      .getByRole("link")
      .all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const box = await link.boundingBox();
      expect(box, "navigation link should be visible").not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("honors prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await page
      .getByRole("navigation", { name: "Publication" })
      .getByRole("link", { name: "Archive" })
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
  });
});
