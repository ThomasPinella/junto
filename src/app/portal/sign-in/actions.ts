"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routes } from "@/config/routes";
import { signInErrorKey } from "@/lib/auth/errors";
import { safeLocalPath } from "@/lib/auth/local-path";
import {
  NEXT_DESTINATION_COOKIE,
  NEXT_DESTINATION_COOKIE_OPTIONS,
} from "@/lib/auth/next-cookie";
import { loadSiteEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.email();

// Requests a Supabase email magic-link/OTP sign-in. Invitation gating is not
// decided here: GoTrue's before_user_created hook rejects uninvited
// addresses (403) and claim_invitations() only ever claims for the verified
// authenticated identity, so this action holds no authorization power.
export async function requestSignInLink(formData: FormData): Promise<void> {
  const email = emailSchema.safeParse(
    String(formData.get("email") ?? "").trim(),
  );
  const next = safeLocalPath(formData.get("next"));
  const signInUrl = (params: URLSearchParams): `/portal/sign-in?${string}` => {
    if (next) {
      params.set("next", next);
    }
    return `${routes.portalSignIn}?${params.toString()}`;
  };
  if (!email.success) {
    redirect(signInUrl(new URLSearchParams({ error: "email-invalid" })));
  }

  // Callback redirects derive from the configured site URL, never from
  // request Host/Origin headers.
  const siteUrl = loadSiteEnv().NEXT_PUBLIC_SITE_URL;
  const cookieStore = await cookies();
  if (next) {
    cookieStore.set(NEXT_DESTINATION_COOKIE, next, {
      ...NEXT_DESTINATION_COOKIE_OPTIONS,
      secure: siteUrl.startsWith("https:"),
    });
  } else {
    cookieStore.delete(NEXT_DESTINATION_COOKIE);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: new URL(routes.authCallback, siteUrl).toString(),
    },
  });

  const errorKey = signInErrorKey(error);
  redirect(
    signInUrl(
      errorKey
        ? new URLSearchParams({ error: errorKey })
        : new URLSearchParams({ status: "sent" }),
    ),
  );
}
