// Own-profile reads through RLS: the id filter always comes from the
// authenticated Supabase user, never from client input.
import "server-only";

import { z } from "zod";

import type { SupabaseServerClient } from "@/lib/supabase/server";

const profileRowSchema = z.object({
  display_name: z.string(),
  slug: z.string(),
  bio: z.string().nullable(),
});

export interface OwnProfile {
  displayName: string;
  slug: string;
  bio: string | null;
}

export async function getOwnProfile(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<OwnProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, slug, bio")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Profile lookup failed (${error.code ?? "?"})`);
  }
  if (!data) {
    return null;
  }
  const row = profileRowSchema.parse(data);
  return {
    displayName: row.display_name,
    slug: row.slug,
    bio: row.bio,
  };
}
