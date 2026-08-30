// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicEssayList } from "@/components/public-essay-list";
import type { PublicEssay } from "@/lib/essay-domain";

afterEach(cleanup);

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

describe("PublicEssayList", () => {
  it("explicitly attributes every essay to its linked chapter", () => {
    render(<PublicEssayList essays={[essay]} />);
    expect(
      screen
        .getByRole("link", { name: "Philadelphia Junto" })
        .getAttribute("href"),
    ).toBe("/juntos/philadelphia");
    expect(
      screen
        .getByRole("link", { name: "Public Thinking" })
        .getAttribute("href"),
    ).toBe("/essays/public-thinking");
  });
});
