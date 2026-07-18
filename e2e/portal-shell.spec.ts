import { expect, test } from "@playwright/test";

test.describe("member portal shell", () => {
  test("renders the portal shell with explicit members-only language", async ({
    page,
  }) => {
    await page.goto("/portal");
    await expect(page).toHaveTitle(/Member portal/);
    await expect(page.getByRole("link", { name: "JUNTO" })).toBeVisible();
    // Explicit privacy language, never a bare "Private"
    // (AGENTS.md, "UI and content standards").
    await expect(page.getByText("Junto members only").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("offers portal navigation back to the portal home and the publication", async ({
    page,
  }) => {
    await page.goto("/portal");
    const nav = page.getByRole("navigation", { name: "Portal" });
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await page.getByRole("link", { name: "JUNTO" }).click();
    await expect(page).toHaveURL("/");
  });

  test("keyboard focus stays visible inside the portal", async ({ page }) => {
    await page.goto("/portal");
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
});
