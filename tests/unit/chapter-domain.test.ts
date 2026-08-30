import { describe, expect, it } from "vitest";

import {
  chapterWriteErrorKey,
  parseChapterForm,
  parseChapterSettingsForm,
} from "@/lib/chapter-domain";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

describe("parseChapterForm", () => {
  it("creates a normalized private-by-default input", () => {
    expect(
      parseChapterForm(
        form({
          name: "  Junto Maple  ",
          slug: "maple",
          description: "  A chapter around a table.  ",
          location: "  Philadelphia  ",
        }),
      ),
    ).toEqual({
      ok: true,
      input: {
        name: "Junto Maple",
        slug: "maple",
        description: "A chapter around a table.",
        location: "Philadelphia",
        archiveVisibility: "private",
      },
    });
  });

  it("accepts an explicitly public archive", () => {
    expect(
      parseChapterForm(
        form({
          name: "Junto Maple",
          slug: "maple",
          "archive-visibility": "public",
        }),
      ),
    ).toMatchObject({
      ok: true,
      input: { archiveVisibility: "public" },
    });
  });

  it.each([
    "Maple",
    "maple_park",
    "-maple",
    "maple-",
    "maple--park",
    "a/b",
    "",
  ])("rejects malformed slug %j", (slug) => {
    expect(parseChapterForm(form({ name: "Maple", slug }))).toEqual({
      ok: false,
      errorKey: "slug-invalid",
    });
  });

  it("reserves only the static portal sign-in slug", () => {
    expect(
      parseChapterForm(form({ name: "Sign in", slug: "sign-in" })),
    ).toEqual({
      ok: false,
      errorKey: "slug-invalid",
    });
    expect(
      parseChapterForm(
        form({ name: "Sign-in Circle", slug: "sign-in-circle" }),
      ),
    ).toMatchObject({ ok: true, input: { slug: "sign-in-circle" } });
  });

  it("fails closed on forged visibility and oversized bounded fields", () => {
    expect(
      parseChapterForm(
        form({
          name: "Maple",
          slug: "maple",
          "archive-visibility": "members",
        }),
      ),
    ).toEqual({ ok: false, errorKey: "visibility-invalid" });
    expect(
      parseChapterForm(
        form({ name: "Maple", slug: "maple", location: "x".repeat(241) }),
      ),
    ).toEqual({ ok: false, errorKey: "location-invalid" });
  });

  it("rejects non-text form parts instead of coercing them", () => {
    const data = form({ name: "Maple", slug: "maple" });
    data.set("name", new File(["Maple"], "name.txt"));
    expect(parseChapterForm(data)).toEqual({
      ok: false,
      errorKey: "name-invalid",
    });
  });
});

describe("parseChapterSettingsForm", () => {
  it("keeps settings bounded and excludes slug/status semantics", () => {
    expect(
      parseChapterSettingsForm(
        form({
          name: " Maple Table ",
          description: "",
          location: " Center City ",
          "archive-visibility": "private",
          slug: "forged",
          status: "inactive",
        }),
      ),
    ).toEqual({
      ok: true,
      input: {
        name: "Maple Table",
        description: null,
        location: "Center City",
        archiveVisibility: "private",
      },
    });
  });
});

describe("chapterWriteErrorKey", () => {
  it("maps duplicate slugs and authorization/constraint failures safely", () => {
    expect(chapterWriteErrorKey({ code: "23505" })).toBe("slug-taken");
    expect(chapterWriteErrorKey({ code: "42501" })).toBe("not-permitted");
    expect(chapterWriteErrorKey({ code: "22023" })).toBe("input-invalid");
    expect(chapterWriteErrorKey({ code: "23514" })).toBe("input-invalid");
  });

  it("does not expose unknown database errors", () => {
    expect(chapterWriteErrorKey({ code: "XX000" })).toBe("request-failed");
    expect(chapterWriteErrorKey({})).toBe("request-failed");
  });
});
