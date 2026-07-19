import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/health/route";

const valid = {
  NEXT_PUBLIC_SITE_URL: "https://junto.example",
  JUNTO_INITIAL_JUNTO_SLUG: "philadelphia",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-publishable-value",
};

afterEach(() => vi.unstubAllEnvs());

describe("GET /health", () => {
  it("returns deterministic non-cacheable readiness without exposing values", async () => {
    for (const [name, value] of Object.entries(valid)) vi.stubEnv(name, value);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-never-appear");

    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ status: "ready" });
    for (const value of [...Object.values(valid), "must-never-appear"]) {
      expect(body).not.toContain(value);
    }
  });

  it.each(Object.keys(valid))(
    "returns 503 when %s is missing",
    async (name) => {
      for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value);
      vi.stubEnv(name, "");
      const response = GET();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "misconfigured" });
    },
  );
});
