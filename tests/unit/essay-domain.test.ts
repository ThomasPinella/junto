import { describe, expect, it } from "vitest";

import {
  deriveEssaySlug,
  essayFromRow,
  essayRowSchema,
  essaySlugSchema,
  essayStatusLabel,
  essayVisibilityLabel,
  essayWriteErrorKey,
  needsPublicExposureConfirmation,
  parseEssayDraftForm,
  parseEssayWorkspaceForm,
  hasExplicitPublicExposureConfirmation,
  publicEssayFromRow,
  publicEssayRowSchema,
} from "@/lib/essay-domain";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("deriveEssaySlug", () => {
  it("derives a lowercase hyphenated slug from a title", () => {
    expect(deriveEssaySlug("What We Owe the Future")).toBe(
      "what-we-owe-the-future",
    );
  });

  it("folds diacritics and collapses punctuation runs", () => {
    expect(deriveEssaySlug("Café — déjà vu, encore!")).toBe(
      "cafe-deja-vu-encore",
    );
  });

  it("never produces leading or trailing hyphens", () => {
    expect(deriveEssaySlug("  ...On Patience?  ")).toBe("on-patience");
  });

  it("falls back to a safe base when nothing survives", () => {
    expect(deriveEssaySlug("!!! ??? ...")).toBe("essay");
  });

  it("is deterministic for the same input", () => {
    expect(deriveEssaySlug("A Steady Title")).toBe(
      deriveEssaySlug("A Steady Title"),
    );
  });

  it("numbers collision attempts deterministically from 2", () => {
    expect(deriveEssaySlug("On Patience", 1)).toBe("on-patience-2");
    expect(deriveEssaySlug("On Patience", 2)).toBe("on-patience-3");
  });

  it("bounds very long titles without a dangling hyphen", () => {
    const slug = deriveEssaySlug(`${"word ".repeat(60)}end`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(essaySlugSchema.safeParse(slug).success).toBe(true);
  });

  it("always satisfies the database slug constraint", () => {
    for (const title of [
      "Plain",
      "MANY   SPACES   here",
      "12345",
      "Ünïcödé & symbols #1",
      "-leading and trailing-",
    ]) {
      const slug = deriveEssaySlug(title);
      expect(
        essaySlugSchema.safeParse(slug).success,
        `derived slug for ${JSON.stringify(title)}: ${slug}`,
      ).toBe(true);
    }
  });
});

describe("essaySlugSchema", () => {
  it("accepts URL-safe lowercase slugs", () => {
    for (const slug of ["a", "on-patience", "essay-2", "a1-b2-c3"]) {
      expect(essaySlugSchema.safeParse(slug).success, slug).toBe(true);
    }
  });

  it("rejects unsafe or malformed slugs", () => {
    for (const slug of [
      "",
      "Upper-Case",
      "spaced out",
      "trailing-",
      "-leading",
      "double--hyphen",
      "unicode-café",
      "path/traversal",
      "query?x=1",
    ]) {
      expect(essaySlugSchema.safeParse(slug).success, slug).toBe(false);
    }
  });
});

describe("parseEssayDraftForm", () => {
  const valid = {
    title: "On patience",
    subtitle: "",
    "body-markdown": "A paragraph.",
    "meeting-id": "11111111-2222-4333-8444-555555555555",
  };

  it("accepts a complete draft with a meeting", () => {
    const result = parseEssayDraftForm(formData(valid));
    expect(result).toEqual({
      ok: true,
      input: {
        title: "On patience",
        subtitle: null,
        bodyMarkdown: "A paragraph.",
        meetingId: "11111111-2222-4333-8444-555555555555",
      },
    });
  });

  it("accepts an empty body and no meeting for a working draft", () => {
    const result = parseEssayDraftForm(
      formData({ ...valid, "body-markdown": "", "meeting-id": "" }),
    );
    expect(result).toEqual({
      ok: true,
      input: {
        title: "On patience",
        subtitle: null,
        bodyMarkdown: "",
        meetingId: null,
      },
    });
  });

  it("requires a nonblank title", () => {
    for (const title of ["", "   "]) {
      expect(parseEssayDraftForm(formData({ ...valid, title }))).toEqual({
        ok: false,
        errorKey: "title-required",
      });
    }
  });

  it("rejects an overlong field", () => {
    expect(
      parseEssayDraftForm(formData({ ...valid, title: "x".repeat(201) })),
    ).toEqual({ ok: false, errorKey: "field-too-long" });
    expect(
      parseEssayDraftForm(formData({ ...valid, subtitle: "x".repeat(301) })),
    ).toEqual({ ok: false, errorKey: "field-too-long" });
  });

  it("rejects a malformed meeting id rather than passing it to a query", () => {
    expect(
      parseEssayDraftForm(formData({ ...valid, "meeting-id": "not-a-uuid" })),
    ).toEqual({ ok: false, errorKey: "meeting-invalid" });
  });
});

describe("essay workspace form", () => {
  const valid = {
    title: "On patience",
    subtitle: "A note",
    "body-markdown": "A paragraph.",
    "meeting-id": "11111111-2222-4333-8444-555555555555",
    visibility: "members_only",
  };

  it("keeps visibility explicit and separate from draft content", () => {
    expect(parseEssayWorkspaceForm(formData(valid))).toEqual({
      ok: true,
      input: {
        draft: {
          title: "On patience",
          subtitle: "A note",
          bodyMarkdown: "A paragraph.",
          meetingId: "11111111-2222-4333-8444-555555555555",
        },
        visibility: "members_only",
      },
    });
  });

  it("fails closed when visibility is missing or invented", () => {
    for (const visibility of ["", "private", "PUBLIC"]) {
      expect(
        parseEssayWorkspaceForm(formData({ ...valid, visibility })),
      ).toEqual({ ok: false, errorKey: "visibility-invalid" });
    }
  });

  it("recognizes only the literal checked confirmation value", () => {
    for (const value of [undefined, "", "true", "false", "1", "yes"]) {
      const data = formData(valid);
      if (value !== undefined) data.set("confirm-public-exposure", value);
      expect(hasExplicitPublicExposureConfirmation(data), String(value)).toBe(
        false,
      );
    }
    const confirmed = formData(valid);
    confirmed.set("confirm-public-exposure", "on");
    expect(hasExplicitPublicExposureConfirmation(confirmed)).toBe(true);
  });
});

describe("essayRowSchema", () => {
  const row = {
    id: "11111111-2222-4333-8444-555555555555",
    author_id: "22222222-2222-4333-8444-555555555555",
    meeting_id: null,
    title: "On patience",
    slug: "on-patience",
    subtitle: null,
    body_markdown: "Body.",
    status: "draft",
    visibility: "members_only",
    published_at: null,
    created_at: "2026-07-01T00:00:00+00:00",
    updated_at: "2026-07-02T00:00:00+00:00",
  };

  it("parses a private row into the domain shape", () => {
    expect(essayFromRow(essayRowSchema.parse(row))).toEqual({
      id: row.id,
      authorId: row.author_id,
      meetingId: null,
      title: "On patience",
      slug: "on-patience",
      subtitle: null,
      bodyMarkdown: "Body.",
      status: "draft",
      visibility: "members_only",
      publishedAt: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it("rejects unknown status or visibility values", () => {
    expect(
      essayRowSchema.safeParse({ ...row, status: "archived" }).success,
    ).toBe(false);
    expect(
      essayRowSchema.safeParse({ ...row, visibility: "secret" }).success,
    ).toBe(false);
  });
});

describe("publicEssayRowSchema", () => {
  const row = {
    slug: "what-we-owe-the-future",
    title: "What we owe the future",
    subtitle: null,
    body_markdown: "# Duty",
    published_at: "2026-06-01T00:00:00+00:00",
    author_name: "Alice Author",
    author_slug: "alice-author",
    junto_name: "Junto Philadelphia",
    junto_slug: "philadelphia",
    meeting_date: "2026-06-22",
    meeting_title: "Future obligations",
  };

  it("parses exactly the safe projection columns", () => {
    expect(publicEssayFromRow(publicEssayRowSchema.parse(row))).toEqual({
      slug: row.slug,
      title: row.title,
      subtitle: null,
      bodyMarkdown: "# Duty",
      publishedAt: row.published_at,
      authorName: "Alice Author",
      authorSlug: "alice-author",
      juntoName: "Junto Philadelphia",
      juntoSlug: "philadelphia",
      meetingDate: "2026-06-22",
      meetingTitle: "Future obligations",
    });
  });

  it("accepts a standalone essay with empty meeting context", () => {
    expect(
      publicEssayRowSchema.safeParse({
        ...row,
        meeting_date: null,
        meeting_title: null,
      }).success,
    ).toBe(true);
  });

  it("rejects any leaked private or internal field outright", () => {
    for (const leak of [
      { id: "11111111-2222-4333-8444-555555555555" },
      { junto_id: "11111111-2222-4333-8444-555555555555" },
      { author_id: "11111111-2222-4333-8444-555555555555" },
      { meeting_id: "11111111-2222-4333-8444-555555555555" },
      { status: "published" },
      { visibility: "public" },
      { email: "alice@example.com" },
      { location: "Carol's apartment" },
      { essay_deadline: "2026-06-20T18:00:00+00:00" },
    ]) {
      expect(
        publicEssayRowSchema.safeParse({ ...row, ...leak }).success,
        `must reject ${Object.keys(leak)[0]}`,
      ).toBe(false);
    }
  });

  it("rejects a row missing required public fields", () => {
    const incomplete: Record<string, unknown> = { ...row };
    delete incomplete.published_at;
    expect(publicEssayRowSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe("needsPublicExposureConfirmation", () => {
  const cases: Array<{
    current: {
      status: "draft" | "published";
      visibility: "public" | "members_only";
    };
    target: {
      status: "draft" | "published";
      visibility: "public" | "members_only";
    };
    expected: boolean;
  }> = [
    {
      current: { status: "draft", visibility: "members_only" },
      target: { status: "published", visibility: "public" },
      expected: true,
    },
    {
      current: { status: "published", visibility: "members_only" },
      target: { status: "published", visibility: "public" },
      expected: true,
    },
    {
      current: { status: "draft", visibility: "public" },
      target: { status: "published", visibility: "public" },
      expected: true,
    },
    {
      current: { status: "published", visibility: "public" },
      target: { status: "published", visibility: "public" },
      expected: false,
    },
    {
      current: { status: "draft", visibility: "members_only" },
      target: { status: "published", visibility: "members_only" },
      expected: false,
    },
    {
      current: { status: "published", visibility: "public" },
      target: { status: "published", visibility: "members_only" },
      expected: false,
    },
    {
      current: { status: "published", visibility: "public" },
      target: { status: "draft", visibility: "public" },
      expected: false,
    },
  ];

  it("requires confirmation exactly when an essay would become internet-visible", () => {
    for (const { current, target, expected } of cases) {
      expect(
        needsPublicExposureConfirmation(current, target),
        `${current.status}/${current.visibility} -> ${target.status}/${target.visibility}`,
      ).toBe(expected);
    }
  });
});

describe("essayWriteErrorKey", () => {
  it("maps database error codes to safe, credential-free keys", () => {
    expect(essayWriteErrorKey(null)).toBeNull();
    expect(essayWriteErrorKey({ code: "23505" })).toBe("slug-taken");
    expect(essayWriteErrorKey({ code: "42501" })).toBe("not-permitted");
    expect(essayWriteErrorKey({ code: "23503" })).toBe("meeting-invalid");
    expect(essayWriteErrorKey({ code: "23514" })).toBe("essay-incomplete");
    expect(essayWriteErrorKey({ code: "22023" })).toBe("invalid-transition");
    expect(
      essayWriteErrorKey({ code: "P0001", message: "confirmation-required" }),
    ).toBe("confirmation-required");
  });

  it("collapses everything unexpected into a generic failure", () => {
    expect(
      essayWriteErrorKey({ code: "P0001", message: "anything else" }),
    ).toBe("request-failed");
    expect(essayWriteErrorKey({ code: "XX000" })).toBe("request-failed");
    expect(essayWriteErrorKey({})).toBe("request-failed");
  });
});

describe("labels", () => {
  it("uses the documented explicit privacy language", () => {
    expect(essayVisibilityLabel("members_only")).toBe("Junto members only");
    expect(essayVisibilityLabel("public")).toBe("Public");
  });

  it("labels publication status plainly", () => {
    expect(essayStatusLabel("draft")).toBe("Draft");
    expect(essayStatusLabel("published")).toBe("Published");
  });
});
