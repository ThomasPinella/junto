import { describe, expect, it } from "vitest";

import { getOwnJuntoEssay, listOwnEssays } from "@/lib/essays";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const JUNTO_ID = "11111111-2222-4333-8444-555555555555";
const AUTHOR_ID = "22222222-2222-4333-8444-555555555555";
const ESSAY_ID = "33333333-2222-4333-8444-555555555555";

const row = {
  id: ESSAY_ID,
  author_id: AUTHOR_ID,
  meeting_id: null,
  title: "Scoped work",
  slug: "scoped-work",
  subtitle: null,
  body_markdown: "Body.",
  status: "draft",
  visibility: "members_only",
  published_at: null,
  created_at: "2026-07-19T00:00:00Z",
  updated_at: "2026-07-19T01:00:00Z",
};

interface QueryTrace {
  table?: string;
  selected?: string;
  filters: Array<[string, unknown]>;
  order?: [string, unknown];
}

function queryClient(trace: QueryTrace): SupabaseServerClient {
  const builder = {
    eq(column: string, value: unknown) {
      trace.filters.push([column, value]);
      return this;
    },
    async order(column: string, options: unknown) {
      trace.order = [column, options];
      return { data: [row], error: null };
    },
    async maybeSingle() {
      return { data: row, error: null };
    },
  };
  return {
    from(table: string) {
      trace.table = table;
      return {
        select(selected: string) {
          trace.selected = selected;
          return builder;
        },
      };
    },
  } as unknown as SupabaseServerClient;
}

describe("essay workspace reads", () => {
  it("lists only server-selected Junto and signed-in author rows", async () => {
    const trace: QueryTrace = { filters: [] };
    const essays = await listOwnEssays(queryClient(trace), JUNTO_ID, AUTHOR_ID);
    expect(essays).toHaveLength(1);
    expect(trace.table).toBe("essays");
    expect(trace.filters).toEqual([
      ["junto_id", JUNTO_ID],
      ["author_id", AUTHOR_ID],
    ]);
    expect(trace.order).toEqual(["updated_at", { ascending: false }]);
  });

  it("scopes editor/preview lookup by id, selected Junto, and author", async () => {
    const trace: QueryTrace = { filters: [] };
    const essay = await getOwnJuntoEssay(
      queryClient(trace),
      JUNTO_ID,
      AUTHOR_ID,
      ESSAY_ID,
    );
    expect(essay?.id).toBe(ESSAY_ID);
    expect(trace.filters).toEqual([
      ["id", ESSAY_ID],
      ["junto_id", JUNTO_ID],
      ["author_id", AUTHOR_ID],
    ]);
  });

  it("turns a malformed route id into the same miss without querying", async () => {
    const client = {
      from() {
        throw new Error("must not query malformed route input");
      },
    } as unknown as SupabaseServerClient;
    await expect(
      getOwnJuntoEssay(client, JUNTO_ID, AUTHOR_ID, "not-a-uuid"),
    ).resolves.toBeNull();
  });
});
