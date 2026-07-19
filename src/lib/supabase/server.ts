// Server-only Supabase client for ordinary application access: the anon key
// plus the authenticated user cookie, so T02 Row Level Security remains the
// authorization boundary. Service-role access is forbidden in application
// code (AGENTS.md, "Architecture and security").
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { loadSupabaseEnv } from "@/lib/env";

export type SupabaseServerClient = SupabaseClient;

// Public archive pages must render identically for every viewer. This client
// carries NO cookies and no session — even a signed-in member browsing a
// public page sees exactly what an anonymous visitor sees, so private
// visibility can never leak into a public response or its cache.
export function createSupabaseAnonClient(): SupabaseServerClient {
  const env = loadSupabaseEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export async function createSupabaseServerClient(): Promise<SupabaseServerClient> {
  const env = loadSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies; src/proxy.ts refreshes
            // and propagates the session cookies for those requests.
          }
        },
      },
    },
  );
}
