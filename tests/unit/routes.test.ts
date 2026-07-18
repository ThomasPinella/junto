import { describe, expect, it } from "vitest";

import { routes } from "@/config/routes";

describe("routes", () => {
  it("keeps the public publication routes stable", () => {
    expect(routes.home).toBe("/");
    expect(routes.essays).toBe("/essays");
    expect(routes.meetings).toBe("/meetings");
    expect(routes.authors).toBe("/authors");
    expect(routes.about).toBe("/about");
    expect(routes.portal).toBe("/portal");
  });

  it("places chapter pages under /juntos/[juntoSlug]", () => {
    expect(routes.junto("philadelphia")).toBe("/juntos/philadelphia");
  });

  it("places essay pages under /essays/[essaySlug]", () => {
    expect(routes.essay("what-do-we-owe-the-future")).toBe(
      "/essays/what-do-we-owe-the-future",
    );
  });
});
