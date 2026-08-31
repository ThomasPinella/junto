import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPublicEssays: vi.fn(),
  listPublicJuntos: vi.fn(),
  listPublicMeetings: vi.fn(),
}));

vi.mock("@/config/site", () => ({
  siteConfig: () => ({ siteUrl: "https://junto.example" }),
}));
vi.mock("@/lib/essays", () => ({
  listPublicEssays: mocks.listPublicEssays,
  publicReadSignal: () => new AbortController().signal,
}));
vi.mock("@/lib/meetings", () => ({
  listPublicJuntos: mocks.listPublicJuntos,
  listPublicMeetings: mocks.listPublicMeetings,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: () => ({ marker: "anonymous-client" }),
}));

import sitemap from "@/app/sitemap";

describe("sitemap route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPublicJuntos.mockResolvedValue([]);
    mocks.listPublicEssays.mockResolvedValue([]);
    mocks.listPublicMeetings.mockResolvedValue([]);
  });

  it("retains only the static public URLs when a query rejects", async () => {
    mocks.listPublicJuntos.mockRejectedValue(new Error("query unavailable"));

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toEqual([
      "https://junto.example/",
      "https://junto.example/essays",
      "https://junto.example/authors",
      "https://junto.example/meetings",
      "https://junto.example/start-a-chapter",
    ]);
    expect(urls.join("\n")).not.toMatch(
      /\/juntos\/|\/essays\/.+|\/authors\/.+|\/meetings\/.+|private|portal|draft|members?/i,
    );
  });
});
