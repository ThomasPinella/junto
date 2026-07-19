import { describe, expect, it } from "vitest";

import { portalNavItems } from "@/lib/portal-nav";

describe("portalNavItems", () => {
  it("gives members the concise portal navigation without Admin", () => {
    const items = portalNavItems("philadelphia", "member");
    expect(items.map((item) => item.label)).toEqual([
      "Home",
      "Meetings",
      "Essays",
      "Members",
      "Profile",
    ]);
  });

  it("adds Admin only when the selected membership is an admin", () => {
    const items = portalNavItems("philadelphia", "admin");
    expect(items.map((item) => item.label)).toEqual([
      "Home",
      "Meetings",
      "Essays",
      "Members",
      "Profile",
      "Admin",
    ]);
  });

  it("never includes Chat, which is outside this run", () => {
    for (const role of ["member", "admin"] as const) {
      const labels = portalNavItems("philadelphia", role).map((i) => i.label);
      expect(labels).not.toContain("Chat");
    }
  });

  it("scopes every destination to the selected Junto", () => {
    const items = portalNavItems("philadelphia", "admin");
    expect(items.map((item) => item.href)).toEqual([
      "/portal/philadelphia",
      "/portal/philadelphia/meetings",
      "/portal/philadelphia/essays",
      "/portal/philadelphia/members",
      "/portal/philadelphia/profile",
      "/portal/philadelphia/admin",
    ]);
  });

  it("URL-encodes the slug rather than trusting it", () => {
    const items = portalNavItems("a b", "member");
    expect(items[0]?.href).toBe("/portal/a%20b");
  });
});
