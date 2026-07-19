import { describe, expect, it } from "vitest";

import type { PublicEssay } from "@/lib/essay-domain";
import { buildPublicArchive } from "@/lib/public-archive-domain";
import {
  GENERIC_AUTHOR_METADATA,
  GENERIC_ESSAY_METADATA,
  publicAuthorMetadata,
  publicEssayMetadata,
} from "@/lib/public-seo";

const essay: PublicEssay = {
  slug: "public-thinking",
  title: "Public Thinking",
  subtitle: "An argument made together",
  bodyMarkdown: "A public body.",
  publishedAt: "2026-07-18T12:00:00Z",
  authorName: "Maya Chen",
  authorSlug: "maya-chen",
  juntoName: "Philadelphia Junto",
  juntoSlug: "philadelphia",
  meetingDate: "2026-07-12",
  meetingTitle: "The shared world",
};

describe("public metadata", () => {
  it("uses one generic outcome for every essay and author miss", () => {
    expect(publicEssayMetadata(null, "https://junto.example")).toEqual(
      GENERIC_ESSAY_METADATA,
    );
    expect(publicAuthorMetadata(null, "https://junto.example")).toEqual(
      GENERIC_AUTHOR_METADATA,
    );
    expect(JSON.stringify(GENERIC_ESSAY_METADATA)).not.toContain("private");
  });

  it("contains only eligible projection content and canonical URLs", () => {
    const metadata = publicEssayMetadata(essay, "https://junto.example");
    expect(metadata.title).toBe(essay.title);
    expect(metadata.alternates).toEqual({
      canonical: "https://junto.example/essays/public-thinking",
    });
    expect(JSON.stringify(metadata)).not.toMatch(
      /email|visibility|status|body/i,
    );

    const author = buildPublicArchive([essay]).authors[0]!;
    const authorMetadata = publicAuthorMetadata(
      author,
      "https://junto.example",
    );
    expect(authorMetadata.title).toBe("Maya Chen");
    expect(authorMetadata.alternates).toEqual({
      canonical: "https://junto.example/authors/maya-chen",
    });
  });
});
