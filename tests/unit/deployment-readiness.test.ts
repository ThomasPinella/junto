import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Railway deployment configuration", () => {
  const railway = readFileSync("railway.toml", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    packageManager?: string;
    scripts?: Record<string, string>;
  };

  it("uses Railpack, the locked package manager, stateless commands, and readiness health", () => {
    expect(railway).toMatch(/builder = "RAILPACK"/);
    expect(railway).toMatch(/buildCommand = "pnpm build"/);
    expect(railway).toMatch(/startCommand = "pnpm start"/);
    expect(railway).toMatch(/healthcheckPath = "\/health"/);
    expect(railway).toMatch(/restartPolicyType = "ON_FAILURE"/);
    expect(railway).not.toMatch(/PORT\s*=|--port|volume|seed/i);
    expect(packageJson.packageManager).toMatch(/^pnpm@/);
    expect(packageJson.scripts?.start).toBe("next start");
  });

  it("never configures a service-role credential or deployment-time database mutation", () => {
    expect(railway).not.toMatch(/service.?role|supabase|migrat|db push/i);
    const applicationSources = [
      "src/lib/env.ts",
      "src/lib/supabase/server.ts",
      "src/app/health/route.ts",
    ].map((path) => readFileSync(path, "utf8"));
    for (const source of applicationSources) {
      expect(source).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    }
  });
});
