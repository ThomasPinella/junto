// Supabase Auth callback: the emailed verification link redirects here with
// a PKCE code. The route exchanges the actual credential for a session,
// claims any matching invitations UNDER that verified session (the
// zero-argument claim_invitations() RPC derives everything from auth.uid()
// and the verified email — callers choose nothing), and then derives the
// destination from the live active memberships returned through RLS. All
// redirects are built from the configured site URL, and any "next" hint is
// validated as a local application path.
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { routes } from "@/config/routes";
import { callbackErrorKey, type CallbackErrorKey } from "@/lib/auth/errors";
import { safeLocalPath } from "@/lib/auth/local-path";
import { NEXT_DESTINATION_COOKIE } from "@/lib/auth/next-cookie";
import { loadSiteEnv } from "@/lib/env";
import { listActiveMemberships } from "@/lib/memberships";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const siteUrl = loadSiteEnv().NEXT_PUBLIC_SITE_URL;
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, siteUrl));
  const denyWith = (key: CallbackErrorKey | "request-failed") =>
    redirectTo(`${routes.portalSignIn}?error=${key}`);

  const cookieStore = await cookies();
  const next =
    safeLocalPath(requestUrl.searchParams.get("next")) ??
    safeLocalPath(cookieStore.get(NEXT_DESTINATION_COOKIE)?.value);
  cookieStore.delete(NEXT_DESTINATION_COOKIE);

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    // GoTrue reports verification failures (expired/used links) as error
    // query parameters instead of a code.
    return denyWith(callbackErrorKey(requestUrl.searchParams));
  }

  const supabase = await createSupabaseServerClient();
  const { data: exchange, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  const user = exchangeError ? null : exchange.user;
  if (!user) {
    return denyWith("link-invalid");
  }

  // Claim while holding the verified session. A claim failure is surfaced,
  // not swallowed: entering the portal with silently unclaimed invitations
  // would misreport "no active memberships" to a genuinely invited person.
  const { error: claimError } = await supabase.rpc("claim_invitations");
  if (claimError) {
    return denyWith("request-failed");
  }

  const memberships = await listActiveMemberships(supabase, user.id);
  if (next) {
    return redirectTo(next);
  }
  const only = memberships.length === 1 ? memberships[0] : undefined;
  return redirectTo(only ? routes.portalJunto(only.juntoSlug) : routes.portal);
}
