import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const publicFiles = [
  "src/app/(public)/page.tsx",
  "src/app/(public)/essays/page.tsx",
  "src/app/(public)/essays/[essaySlug]/page.tsx",
  "src/app/(public)/authors/page.tsx",
  "src/app/(public)/authors/[authorSlug]/page.tsx",
  "src/app/(public)/meetings/page.tsx",
  "src/app/(public)/juntos/[juntoSlug]/page.tsx",
  "src/app/(public)/juntos/[juntoSlug]/meetings/[meetingDate]/page.tsx",
  "src/app/sitemap.ts",
];

describe("public application boundary", () => {
  it("never imports profile access or carries privileged/base-table reads", () => {
    for (const path of publicFiles) {
      const source = readFileSync(resolve(path), "utf8");
      expect(source, path).not.toMatch(/@\/lib\/profiles|service.?role/i);
      expect(source, path).not.toMatch(/\.from\(["'](?:essays|profiles)["']\)/);
      expect(source, path).toContain("createSupabaseAnonClient");
    }
  });

  it("validates scoped public route input before opening an anonymous data path", () => {
    const path =
      "src/app/(public)/juntos/[juntoSlug]/meetings/[meetingDate]/page.tsx";
    const source = readFileSync(resolve(path), "utf8");
    const juntoValidation = source.indexOf(
      "juntoSlugSchema.safeParse(juntoSlug)",
    );
    const dateValidation = source.indexOf(
      "meetingDateSchema.safeParse(meetingDate)",
    );
    const clientCreation = source.indexOf("createSupabaseAnonClient()");

    expect(juntoValidation, "Junto slug validation").toBeGreaterThan(-1);
    expect(dateValidation, "meeting date validation").toBeGreaterThan(-1);
    expect(clientCreation, "anonymous client creation").toBeGreaterThan(-1);
    for (const boundary of [juntoValidation, dateValidation]) {
      expect(
        boundary,
        "route boundary must precede client creation",
      ).toBeLessThan(clientCreation);
    }

    const chapterPath = "src/app/(public)/juntos/[juntoSlug]/page.tsx";
    const chapterSource = readFileSync(resolve(chapterPath), "utf8");
    expect(
      chapterSource.indexOf("juntoSlugSchema.safeParse(juntoSlug)"),
    ).toBeGreaterThan(-1);
    expect(
      chapterSource.indexOf("juntoSlugSchema.safeParse(juntoSlug)"),
    ).toBeLessThan(chapterSource.indexOf("createSupabaseAnonClient()"));
  });
});
