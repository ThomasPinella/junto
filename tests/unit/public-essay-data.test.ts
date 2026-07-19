import { describe, expect, it } from "vitest";

import { PUBLIC_READ_TIMEOUT_MS, listPublicEssays } from "@/lib/essays";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const validRow = {
  slug: "attention-and-care",
  title: "Attention and Care",
  subtitle: null,
  body_markdown: "Public words.",
  published_at: "2026-07-18T12:00:00Z",
  author_name: "Maya Chen",
  author_slug: "maya-chen",
  junto_name: "Philadelphia Junto",
  junto_slug: "philadelphia",
  meeting_date: "2026-07-12",
  meeting_title: "What deserves notice?",
};

function queryStub(data: unknown) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = {
    select(...args: unknown[]) {
      calls.push(["select", ...args]);
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push(["eq", ...args]);
      return builder;
    },
    order(...args: unknown[]) {
      calls.push(["order", ...args]);
      return builder;
    },
    abortSignal(...args: unknown[]) {
      calls.push(["abortSignal", ...args]);
      return builder;
    },
    limit(...args: unknown[]) {
      calls.push(["limit", ...args]);
      return builder;
    },
    then(resolve: (value: unknown) => void) {
      resolve({ data, error: null });
    },
  };
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      return builder;
    },
  } as unknown as SupabaseServerClient;
  return { client, calls, tables };
}

describe("public essay data access", () => {
  it("uses only the narrow projection with validated chapter, author, and meeting filters", async () => {
    const { client, calls, tables } = queryStub([validRow]);
    const essays = await listPublicEssays(client, {
      juntoSlug: "philadelphia",
      authorSlug: "maya-chen",
      meetingDate: "2026-07-12",
      limit: 12,
    });
    expect(essays).toHaveLength(1);
    expect(tables).toEqual(["public_essays"]);
    expect(calls.filter(([name]) => name === "eq")).toEqual([
      ["eq", "junto_slug", "philadelphia"],
      ["eq", "author_slug", "maya-chen"],
      ["eq", "meeting_date", "2026-07-12"],
    ]);
    expect(calls).toContainEqual(["limit", 12]);
    expect(calls.find(([name]) => name === "abortSignal")?.[1]).toBeInstanceOf(
      AbortSignal,
    );
  });

  it("rejects invalid filters before any public request", async () => {
    const untouchable = {
      from() {
        throw new Error("invalid public filters must not query");
      },
    } as unknown as SupabaseServerClient;
    await expect(
      listPublicEssays(untouchable, {
        juntoSlug: "philadelphia",
        authorSlug: "Maya Chen",
      }),
    ).resolves.toEqual([]);
    await expect(
      listPublicEssays(untouchable, {
        juntoSlug: "philadelphia",
        meetingDate: "2026-02-30",
      }),
    ).resolves.toEqual([]);
  });

  it("fails closed when a projection response grows a private column", async () => {
    const { client } = queryStub([{ ...validRow, visibility: "public" }]);
    await expect(
      listPublicEssays(client, { juntoSlug: "philadelphia" }),
    ).rejects.toThrow();
  });

  it("keeps every public read within the bounded outage budget", () => {
    expect(PUBLIC_READ_TIMEOUT_MS).toBeGreaterThan(0);
    expect(PUBLIC_READ_TIMEOUT_MS).toBeLessThanOrEqual(2_500);
  });
});
