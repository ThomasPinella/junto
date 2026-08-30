import { describe, expect, it } from "vitest";

import {
  getPublicJunto,
  listPublicJuntos,
  listPublicMeetings,
} from "@/lib/meetings";
import type { SupabaseServerClient } from "@/lib/supabase/server";

function queryStub(rowsByTable: Record<string, unknown>) {
  const calls: Array<[string, ...unknown[]]> = [];
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
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
        limit(...args: unknown[]) {
          calls.push(["limit", ...args]);
          return builder;
        },
        abortSignal(...args: unknown[]) {
          calls.push(["abortSignal", ...args]);
          return builder;
        },
        then(resolve: (value: unknown) => void) {
          resolve({ data: rowsByTable[table], error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseServerClient;
  return { client, calls, tables };
}

const meetingRow = {
  junto_slug: "philadelphia",
  meeting_date: "2026-07-12",
  title: "The shared world",
  theme: null,
  description: null,
  status: "completed",
};

describe("public chapter and meeting data access", () => {
  it("lists only explicitly active public chapter fields", async () => {
    const { client, calls, tables } = queryStub({
      juntos: [
        { name: "Philadelphia Junto", slug: "philadelphia", description: null },
      ],
    });

    await expect(listPublicJuntos(client)).resolves.toHaveLength(1);
    expect(tables).toEqual(["juntos"]);
    expect(calls.filter(([name]) => name === "eq")).toEqual([
      ["eq", "status", "active"],
      ["eq", "archive_visibility", "public"],
    ]);
    expect(calls.find(([name]) => name === "select")?.[1]).toBe(
      "name, slug, description",
    );
    expect(calls.find(([name]) => name === "abortSignal")?.[1]).toBeInstanceOf(
      AbortSignal,
    );
  });

  it("supports aggregate meetings and an optional validated chapter filter", async () => {
    const aggregate = queryStub({ public_meetings: [meetingRow] });
    await expect(listPublicMeetings(aggregate.client)).resolves.toHaveLength(1);
    expect(aggregate.tables).toEqual(["public_meetings"]);
    expect(aggregate.calls.filter(([name]) => name === "eq")).toEqual([]);
    expect(
      aggregate.calls.find(([name]) => name === "abortSignal")?.[1],
    ).toBeInstanceOf(AbortSignal);

    const scoped = queryStub({ public_meetings: [meetingRow] });
    await listPublicMeetings(scoped.client, { juntoSlug: "philadelphia" });
    expect(scoped.calls.filter(([name]) => name === "eq")).toEqual([
      ["eq", "junto_slug", "philadelphia"],
    ]);
  });

  it("rejects malformed chapter filters without querying", async () => {
    const untouchable = {
      from() {
        throw new Error("malformed filters must not query");
      },
    } as unknown as SupabaseServerClient;
    await expect(
      listPublicMeetings(untouchable, { juntoSlug: "Not A Chapter" }),
    ).resolves.toEqual([]);
    await expect(
      getPublicJunto(untouchable, "Not A Chapter"),
    ).resolves.toBeNull();
  });

  it("fails closed if the narrow chapter response grows a private field", async () => {
    const { client } = queryStub({
      juntos: [
        {
          name: "Philadelphia Junto",
          slug: "philadelphia",
          description: null,
          location: "must remain absent",
        },
      ],
    });
    await expect(listPublicJuntos(client)).rejects.toThrow();
  });
});
