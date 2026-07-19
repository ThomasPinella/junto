// Server-only: SUPABASE_SERVICE_ROLE_KEY must never reach browser code
// (AGENTS.md, "Architecture and security").
import "server-only";

import { z } from "zod";

// Configuration belongs in environment variables and must fail clearly when
// required variables are missing (AGENTS.md, "Architecture and security").
export class EnvValidationError extends Error {
  constructor(issues: string[]) {
    super(
      [
        "Invalid environment configuration:",
        ...issues.map((issue) => `  - ${issue}`),
        "See .env.example for the required variables and placeholder values.",
      ].join("\n"),
    );
    this.name = "EnvValidationError";
  }
}

export const juntoSlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'must be a lowercase URL slug such as "philadelphia"',
  );

const siteEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url({ error: "must be an absolute URL" }),
  // Route seam for docs/implementation: `/` serves the explicitly configured
  // initial chapter without hard-coding a single-Junto data assumption
  // (.dev/runs/core-product/implementation.md, "Decisions and boundaries").
  JUNTO_INITIAL_JUNTO_SLUG: juntoSlugSchema,
});

// The service-role key is deliberately NOT part of the application
// environment: T02 Row Level Security plus the authenticated user cookie is
// the application's entire authorization boundary, and no route, component,
// or server action may ever hold service-role credentials. Privileged
// fixtures live only in the loopback-guarded test harnesses.
const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "must be an absolute URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "must not be empty"),
});

type EnvSource = Record<string, string | undefined>;

function parseEnv<Schema extends z.ZodObject>(
  schema: Schema,
  source: EnvSource,
): z.infer<Schema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => {
        const name = issue.path.join(".");
        const reason =
          issue.code === "invalid_type" && issue.input === undefined
            ? "is required but missing"
            : issue.message;
        return `${name} ${reason}`;
      }),
    );
  }
  return result.data;
}

export type SiteEnv = z.infer<typeof siteEnvSchema>;
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type ApplicationEnv = SiteEnv & SupabaseEnv;

export function loadSiteEnv(source: EnvSource = process.env): SiteEnv {
  return parseEnv(siteEnvSchema, source);
}

export function loadSupabaseEnv(source: EnvSource = process.env): SupabaseEnv {
  return parseEnv(supabaseEnvSchema, source);
}

export function loadApplicationEnv(
  source: EnvSource = process.env,
): ApplicationEnv {
  return { ...loadSiteEnv(source), ...loadSupabaseEnv(source) };
}
