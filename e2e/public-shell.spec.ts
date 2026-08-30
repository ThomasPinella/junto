import { expect, test } from "@playwright/test";

// The Member Portal entry is private: unauthenticated visits land on the
// sign-in page (T03).
const publicShells = [
  { label: "Archive", path: "/essays", finalUrl: "/essays" },
  { label: "Meetings", path: "/meetings", finalUrl: "/meetings" },
  { label: "Authors", path: "/authors", finalUrl: "/authors" },
  { label: "About", path: "/about", finalUrl: "/about" },
  { label: "Member Portal", path: "/portal", finalUrl: "/portal/sign-in" },
] as const;

const allShellPaths = ["/", ...publicShells.map((shell) => shell.path)];

test.describe("public publication shell", () => {
  test("serves the network overview and public chapter directory at /", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Junto");
    await expect(
      page.getByRole("link", { name: "JUNTO", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Network archive", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Public chapters" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Recent essays across chapters",
      }),
    ).toBeVisible();
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
      await expect(page).toHaveURL(shell.finalUrl);
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

  test("public meeting URLs miss uniformly when no record is servable", async ({
    page,
  }) => {
    // Stack-free baseline: with no database reachable, every public meeting
    // detail request — plausible or malformed — must resolve to the same
    // non-disclosing not-found rather than an error or a leak.
    for (const path of [
      "/juntos/philadelphia/meetings/2026-01-01",
      "/juntos/no-such-junto/meetings/2026-01-01",
      "/juntos/philadelphia/meetings/not-a-date",
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" }),
      ).toBeVisible();
    }
  });

  test("unavailable chapter pages use one metadata-safe not-found outcome", async ({
    page,
  }) => {
    const titles = [];
    for (const path of [
      "/juntos/philadelphia",
      "/juntos/no-such-junto",
      "/juntos/Not%20A%20Slug",
    ]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" }),
      ).toBeVisible();
      titles.push(await page.title());
    }
    expect(new Set(titles)).toEqual(new Set(["Junto chapter · Junto"]));
  });

  test("public essay and author misses stay generic and bounded with the archive unavailable", async ({
    page,
  }) => {
    for (const path of [
      "/essays/no-such-public-essay",
      "/essays/Not%20A%20Slug",
      "/authors/no-such-public-author",
      "/authors/Not%20A%20Slug",
    ]) {
      const started = Date.now();
      await page.goto(path);
      expect(
        Date.now() - started,
        `${path} must render within the read cap`,
      ).toBeLessThan(4_500);
      await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" }),
      ).toBeVisible();
      await expect(page).toHaveTitle(/^(Essay|Author) · Junto$/);
    }
  });

  test("invalid archive filters and sitemap fail closed without disclosure", async ({
    page,
  }) => {
    await page.goto("/essays?author=Not%20A%20Slug");
    await expect(
      page.getByText("The public essay record is quiet for now."),
    ).toBeVisible();
    const source = await page.content();
    expect(source).not.toMatch(/profile|members_only|service_role/);
    const response = await page.request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const sitemap = await response.text();
    const locations = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(
      ([, location]) => location,
    );
    expect(locations.toSorted()).toEqual(
      [
        "http://127.0.0.1:3210/",
        "http://127.0.0.1:3210/essays",
        "http://127.0.0.1:3210/authors",
        "http://127.0.0.1:3210/meetings",
      ].toSorted(),
    );
    expect(locations.join("\n")).not.toMatch(
      /\/juntos\/|\/essays\/.+|\/authors\/.+|\/meetings\/.+/,
    );
    expect(sitemap).not.toMatch(
      /private|portal|draft|members?|profile|internal|service[_-]?role/i,
    );
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
