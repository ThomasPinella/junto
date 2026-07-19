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
});
