import { describe, expect, it } from "vitest";

import { EnvValidationError, loadSiteEnv, loadSupabaseEnv } from "@/lib/env";

const validSite = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  JUNTO_INITIAL_JUNTO_SLUG: "philadelphia",
};

const validSupabase = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
};

describe("loadSiteEnv", () => {
  it("returns the parsed site environment when every variable is valid", () => {
    expect(loadSiteEnv(validSite)).toEqual({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      JUNTO_INITIAL_JUNTO_SLUG: "philadelphia",
    });
  });

  it("names the missing variable explicitly", () => {
    const incomplete: Record<string, string> = { ...validSite };
    delete incomplete.JUNTO_INITIAL_JUNTO_SLUG;
    expect(() => loadSiteEnv(incomplete)).toThrowError(
      /JUNTO_INITIAL_JUNTO_SLUG/,
    );
  });

  it("points at .env.example so the failure is actionable", () => {
    expect(() => loadSiteEnv({})).toThrowError(/\.env\.example/);
  });

  it("rejects a site URL that is not a URL", () => {
    expect(() =>
      loadSiteEnv({ ...validSite, NEXT_PUBLIC_SITE_URL: "not-a-url" }),
    ).toThrowError(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects an initial Junto slug that is not a lowercase URL slug", () => {
    expect(() =>
      loadSiteEnv({ ...validSite, JUNTO_INITIAL_JUNTO_SLUG: "Philadelphia!" }),
    ).toThrowError(/JUNTO_INITIAL_JUNTO_SLUG/);
  });

  it("throws EnvValidationError so callers can distinguish config failures", () => {
    expect(() => loadSiteEnv({})).toThrowError(EnvValidationError);
  });
});

describe("loadSupabaseEnv", () => {
  it("returns the parsed Supabase environment when every variable is valid", () => {
    expect(loadSupabaseEnv(validSupabase)).toEqual(validSupabase);
  });

  it("names every missing variable in one message", () => {
    let message = "";
    try {
      loadSupabaseEnv({});
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("rejects a Supabase URL that is not a URL", () => {
    expect(() =>
      loadSupabaseEnv({ ...validSupabase, NEXT_PUBLIC_SUPABASE_URL: "nope" }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
