import { describe, expect, it } from "vitest";

import { chapterNameFromSlug } from "@/config/site";

describe("chapterNameFromSlug", () => {
  it("turns a chapter slug into a readable name", () => {
    expect(chapterNameFromSlug("philadelphia")).toBe("Philadelphia");
  });

  it("handles multi-word slugs", () => {
    expect(chapterNameFromSlug("new-york")).toBe("New York");
  });
});
