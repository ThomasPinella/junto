import { describe, expect, it } from "vitest";

import {
  buildPublicArchive,
  estimateReadingMinutes,
  parseArchiveFilters,
  relatedPublicEssays,
} from "@/lib/public-archive-domain";
import type { PublicEssay } from "@/lib/essay-domain";

const essays: PublicEssay[] = [
  {
    slug: "attention-and-care",
    title: "Attention and Care",
    subtitle: "A note on noticing",
    bodyMarkdown: "word ".repeat(226),
    publishedAt: "2026-07-18T12:00:00Z",
    authorName: "Maya Chen",
    authorSlug: "maya-chen",
    juntoName: "Philadelphia Junto",
    juntoSlug: "philadelphia",
    meetingDate: "2026-07-12",
    meetingTitle: "What deserves notice?",
  },
  {
    slug: "the-common-good",
    title: "The Common Good",
    subtitle: null,
    bodyMarkdown: "A short essay.",
    publishedAt: "2026-07-17T12:00:00Z",
    authorName: "Maya Chen",
    authorSlug: "maya-chen",
    juntoName: "Philadelphia Junto",
    juntoSlug: "philadelphia",
    meetingDate: "2026-06-22",
    meetingTitle: "Public obligation",
  },
  {
    slug: "future-neighbors",
    title: "Future Neighbors",
    subtitle: null,
    bodyMarkdown: "Another essay.",
    publishedAt: "2026-07-16T12:00:00Z",
    authorName: "Daniel Ortiz",
    authorSlug: "daniel-ortiz",
    juntoName: "Philadelphia Junto",
    juntoSlug: "philadelphia",
    meetingDate: "2026-07-12",
    meetingTitle: "What deserves notice?",
  },
];

describe("public archive domain", () => {
  it("estimates reading time deterministically with a one-minute floor", () => {
    expect(estimateReadingMinutes("A short essay.")).toBe(1);
    expect(estimateReadingMinutes("word ".repeat(226))).toBe(2);
  });

  it("derives authors and meetings only from eligible public essays", () => {
    const archive = buildPublicArchive(essays);
    expect(archive.authors.map((author) => author.slug)).toEqual([
      "daniel-ortiz",
      "maya-chen",
    ]);
    expect(
      archive.authors.find((author) => author.slug === "maya-chen")?.essays,
    ).toHaveLength(2);
    expect(archive.meetings).toHaveLength(2);
  });

  it("keeps same-date meetings distinct while one global author can span chapters", () => {
    const crossChapter: PublicEssay = {
      ...essays[0]!,
      slug: "attention-in-boston",
      publishedAt: "2026-07-19T12:00:00Z",
      juntoName: "Boston Junto",
      juntoSlug: "boston",
    };
    const archive = buildPublicArchive([...essays, crossChapter]);

    expect(
      archive.meetings
        .filter((meeting) => meeting.date === "2026-07-12")
        .map((meeting) => meeting.juntoSlug)
        .sort(),
    ).toEqual(["boston", "philadelphia"]);
    const maya = archive.authors.find((author) => author.slug === "maya-chen");
    expect(maya?.chapters).toEqual([
      { slug: "boston", name: "Boston Junto" },
      { slug: "philadelphia", name: "Philadelphia Junto" },
    ]);
    expect(maya?.meetings).toHaveLength(3);
  });

  it("keeps related content separate and excludes the current essay", () => {
    expect(relatedPublicEssays(essays[0]!, essays)).toEqual({
      moreByAuthor: [essays[1]],
      moreFromMeeting: [essays[2]],
    });
  });

  it("accepts only canonical public filter shapes", () => {
    expect(
      parseArchiveFilters({
        junto: "philadelphia",
        author: "maya-chen",
        meeting: "2026-07-12",
      }),
    ).toEqual({
      juntoSlug: "philadelphia",
      authorSlug: "maya-chen",
      meetingDate: "2026-07-12",
    });
    expect(parseArchiveFilters({ author: "Maya Chen" })).toBeNull();
    expect(parseArchiveFilters({ meeting: "2026-02-30" })).toBeNull();
    expect(
      parseArchiveFilters({ author: ["maya-chen", "daniel-ortiz"] }),
    ).toBeNull();
  });
});
