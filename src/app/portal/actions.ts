"use server";

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  // A missing session is already the desired outcome; any other failure is
  // surfaced instead of pretending the sign-out happened.
  if (error && error.name !== "AuthSessionMissingError") {
    redirect(`${routes.portalSignIn}?error=request-failed`);
  }
  redirect(`${routes.portalSignIn}?status=signed-out`);
}
