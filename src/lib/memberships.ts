// Active-membership reads through RLS. The durable authorization source is
// the active junto_members record (docs/membership/authentication-and-
// membership.md §3.2); these queries run with the anon key plus the user's
// cookie, so Row Level Security enforces what is visible. The user id is
// always the authenticated Supabase user's — never client-supplied.
import "server-only";

import { z } from "zod";

import type { SupabaseServerClient } from "@/lib/supabase/server";

const membershipRowSchema = z.object({
  id: z.uuid(),
  role: z.enum(["member", "admin"]),
  junto: z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
  }),
});

export interface ActiveMembership {
  membershipId: string;
  role: "member" | "admin";
  juntoId: string;
  juntoName: string;
  juntoSlug: string;
}

export async function listActiveMemberships(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<ActiveMembership[]> {
  const { data, error } = await supabase
    .from("junto_members")
    .select("id, role, junto:juntos!inner(id, name, slug)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) {
    // Fail closed with a credential-free message; callers treat a thrown
    // lookup as "no access", never as a reason to skip authorization.
    throw new Error(`Active-membership lookup failed (${error.code ?? "?"})`);
  }
  const rows = z.array(membershipRowSchema).parse(data ?? []);
  return rows
    .map((row) => ({
      membershipId: row.id,
      role: row.role,
      juntoId: row.junto.id,
      juntoName: row.junto.name,
      juntoSlug: row.junto.slug,
    }))
    .sort((a, b) => a.juntoName.localeCompare(b.juntoName));
}

const rosterMemberRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  role: z.enum(["member", "admin"]),
});

const rosterProfileRowSchema = z.object({
  id: z.uuid(),
  display_name: z.string(),
  bio: z.string().nullable(),
});

export interface RosterMember {
  membershipId: string;
  userId: string;
  role: "member" | "admin";
  displayName: string;
  bio: string | null;
}

// The chapter roster: active members of one Junto with their profiles.
// RLS scopes both queries — junto_members rows are visible only to active
// co-members, and profiles only through a shared active Junto. Email
// addresses are never selected (docs/experience/member-portal.md).
export async function listActiveRoster(
  supabase: SupabaseServerClient,
  juntoId: string,
): Promise<RosterMember[]> {
  const { data: memberData, error: memberError } = await supabase
    .from("junto_members")
    .select("id, user_id, role")
    .eq("junto_id", juntoId)
    .eq("status", "active");
  if (memberError) {
    throw new Error(`Roster lookup failed (${memberError.code ?? "?"})`);
  }
  const members = z.array(rosterMemberRowSchema).parse(memberData ?? []);
  if (members.length === 0) {
    return [];
  }
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, bio")
    .in(
      "id",
      members.map((member) => member.user_id),
    );
  if (profileError) {
    throw new Error(
      `Roster profile lookup failed (${profileError.code ?? "?"})`,
    );
  }
  const profiles = new Map(
    z
      .array(rosterProfileRowSchema)
      .parse(profileData ?? [])
      .map((profile) => [profile.id, profile]),
  );
  return members
    .flatMap((member) => {
      const profile = profiles.get(member.user_id);
      // A membership without a visible profile cannot happen for claimed
      // members (claim_invitations creates the profile first); rather than
      // invent a name, omit the row.
      if (!profile) {
        return [];
      }
      return [
        {
          membershipId: member.id,
          userId: member.user_id,
          role: member.role,
          displayName: profile.display_name,
          bio: profile.bio,
        },
      ];
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
