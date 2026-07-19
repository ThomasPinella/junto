// Next.js 16 proxy (the supported successor to middleware): refreshes and
// propagates Supabase Auth cookies for private routes so expired access
// tokens are renewed on the request that carries them. This is cookie
// PLUMBING only — it is never an authorization decision. Every protected
// server component and action re-checks the authenticated user and the live
// active membership through RLS on each request.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { loadSupabaseEnv } from "@/lib/env";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = loadSupabaseEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Refreshed cookies must reach both the downstream render (via the
          // mutated request) and the browser (via the response).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Triggers a token refresh when needed; the result is deliberately unused
  // because access decisions happen in protected server code, not here.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ["/portal/:path*", "/auth/:path*"],
};
