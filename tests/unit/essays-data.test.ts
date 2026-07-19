import { describe, expect, it } from "vitest";

import { createEssayDraft, getPublicEssayBySlug } from "@/lib/essays";
import type { SupabaseServerClient } from "@/lib/supabase/server";

// Network-free proofs for the slug-collision retry loop and the fail-closed
// public slug lookup. The stub implements only the exact query-builder
// surface the data layer uses; anything else throws, so a passing test
// cannot hide an unobserved call shape.

interface InsertedRow {
  table: string;
  row: Record<string, unknown>;
  selected: string;
}

function stubInsertClient(
  handler: (row: Record<string, unknown>) => {
    data: unknown;
    error: { code?: string; message?: string } | null;
  },
): { client: SupabaseServerClient; inserted: InsertedRow[] } {
  const inserted: InsertedRow[] = [];
  const client = {
    from(table: string) {
      if (table !== "essays") {
        throw new Error(`unexpected table in stub: ${table}`);
      }
      return {
        insert(row: Record<string, unknown>) {
          return {
            select(selected: string) {
              inserted.push({ table, row, selected });
              return {
                async single() {
                  return handler(row);
                },
              };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseServerClient, inserted };
}

const JUNTO_ID = "11111111-2222-4333-8444-555555555555";
const ESSAY_ID = "99999999-2222-4333-8444-555555555555";

const draftInput = {
  title: "On Patience",
  subtitle: null,
  bodyMarkdown: "A body.",
  meetingId: null,
};

describe("createEssayDraft", () => {
  it("derives the slug application-side and creates the draft", async () => {
    const { client, inserted } = stubInsertClient((row) => ({
      data: { id: ESSAY_ID, slug: row.slug },
      error: null,
    }));
    const result = await createEssayDraft(client, JUNTO_ID, draftInput);
    expect(result).toEqual({ ok: true, id: ESSAY_ID, slug: "on-patience" });
    expect(inserted).toHaveLength(1);
    const row = inserted[0]!.row;
    expect(row.junto_id).toBe(JUNTO_ID);
    expect(row.slug).toBe("on-patience");
    // Identity and publication state are never client-supplied.
    expect(row).not.toHaveProperty("author_id");
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("published_at");
    expect(row).not.toHaveProperty("id");
  });

  it("retries deterministically numbered slugs on collision", async () => {
    const taken = new Set(["on-patience", "on-patience-2"]);
    const { client, inserted } = stubInsertClient((row) =>
      taken.has(String(row.slug))
        ? { data: null, error: { code: "23505" } }
        : { data: { id: ESSAY_ID, slug: row.slug }, error: null },
    );
    const result = await createEssayDraft(client, JUNTO_ID, draftInput);
    expect(result).toEqual({ ok: true, id: ESSAY_ID, slug: "on-patience-3" });
    expect(inserted.map((call) => call.row.slug)).toEqual([
      "on-patience",
      "on-patience-2",
      "on-patience-3",
    ]);
  });

  it("gives up with a safe error when every attempt collides", async () => {
    const { client, inserted } = stubInsertClient(() => ({
      data: null,
      error: { code: "23505" },
    }));
    const result = await createEssayDraft(client, JUNTO_ID, draftInput);
    expect(result).toEqual({ ok: false, errorKey: "slug-taken" });
    // Bounded: the loop must not hammer the database unbounded.
    expect(inserted.length).toBeGreaterThan(1);
    expect(inserted.length).toBeLessThanOrEqual(30);
  });

  it("does not retry on non-collision failures", async () => {
    const { client, inserted } = stubInsertClient(() => ({
      data: null,
      error: { code: "42501" },
    }));
    const result = await createEssayDraft(client, JUNTO_ID, draftInput);
    expect(result).toEqual({ ok: false, errorKey: "not-permitted" });
    expect(inserted).toHaveLength(1);
  });
});

describe("getPublicEssayBySlug", () => {
  it("resolves a malformed slug to the uniform miss without any query", async () => {
    const untouchable = {
      from() {
        throw new Error("the public reader must not query a malformed slug");
      },
    } as unknown as SupabaseServerClient;
    for (const slug of [
      "Not A Slug",
      "trailing-",
      "../../etc/passwd",
      "a b",
      "",
    ]) {
      await expect(getPublicEssayBySlug(untouchable, slug)).resolves.toBeNull();
    }
  });
});
