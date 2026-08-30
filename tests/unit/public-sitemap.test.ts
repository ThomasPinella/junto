import { describe, expect, it } from "vitest";

import type { PublicEssay } from "@/lib/essay-domain";
import type { PublicMeeting } from "@/lib/meeting-domain";
import { buildPublicSitemap } from "@/lib/public-sitemap";
import type { PublicJunto } from "@/lib/meetings";

const chapters: PublicJunto[] = [
  { name: "Boston Junto", slug: "boston", description: null },
  { name: "Philadelphia Junto", slug: "philadelphia", description: null },
];

const essay: PublicEssay = {
  slug: "public-thinking",
  title: "Public Thinking",
  subtitle: null,
  bodyMarkdown: "Public words.",
  publishedAt: "2026-07-18T12:00:00Z",
  authorName: "Maya Chen",
  authorSlug: "maya-chen",
  juntoName: "Philadelphia Junto",
  juntoSlug: "philadelphia",
  meetingDate: "2026-07-12",
  meetingTitle: "The shared world",
};
const meeting: PublicMeeting = {
  juntoSlug: "philadelphia",
  meetingDate: "2026-07-12",
  title: "The shared world",
  theme: null,
  description: null,
  status: "completed",
};

describe("public sitemap", () => {
  it("adds only supplied eligible public projection records", () => {
    const urls = buildPublicSitemap(
      "https://junto.example",
      chapters,
      [essay],
      [meeting],
    ).map((entry) => entry.url);
    expect(urls).toContain("https://junto.example/essays/public-thinking");
    expect(urls).toContain("https://junto.example/juntos/boston");
    expect(urls).toContain("https://junto.example/juntos/philadelphia");
    expect(urls).toContain("https://junto.example/authors/maya-chen");
    expect(urls).toContain(
      "https://junto.example/juntos/philadelphia/meetings/2026-07-12",
    );
    expect(urls.join(" ")).not.toMatch(/portal|draft|members-only|profile/);
  });

  it("cannot invent dynamic records from an empty projection", () => {
    const urls = buildPublicSitemap("https://junto.example", [], [], []).map(
      (entry) => entry.url,
    );
    expect(urls).toEqual([
      "https://junto.example/",
      "https://junto.example/essays",
      "https://junto.example/authors",
      "https://junto.example/meetings",
    ]);
  });
});
