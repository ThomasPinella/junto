import "server-only";

import { z } from "zod";

import type { InvitationInput } from "@/lib/membership-domain";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const invitationRowSchema = z.object({
  id: z.uuid(),
  email_normalized: z.email(),
  role: z.enum(["member", "admin"]),
  status: z.enum(["pending", "claimed", "revoked", "expired"]),
});

export interface AdminInvitation {
  id: string;
  email: string;
  role: "member" | "admin";
  status: "pending" | "claimed" | "revoked" | "expired";
}

export async function listJuntoInvitations(
  supabase: SupabaseServerClient,
  juntoId: string,
): Promise<AdminInvitation[]> {
  const { data, error } = await supabase
    .from("junto_invitations")
    .select("id, email_normalized, role, status")
    .eq("junto_id", juntoId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Invitation lookup failed (${error.code ?? "?"})`);
  }
  return z
    .array(invitationRowSchema)
    .parse(data ?? [])
    .map((row) => ({
      id: row.id,
      email: row.email_normalized,
      role: row.role,
      status: row.status,
    }));
}

export type AdminWriteResult =
  | { ok: true }
  | {
      ok: false;
      errorKey: "already-pending" | "not-permitted" | "request-failed";
    };

export async function createJuntoInvitation(
  supabase: SupabaseServerClient,
  juntoId: string,
  input: InvitationInput,
): Promise<AdminWriteResult> {
  const { error } = await supabase.from("junto_invitations").insert({
    junto_id: juntoId,
    email_normalized: input.email,
    role: input.role,
  });
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, errorKey: "already-pending" };
  if (error.code === "42501") return { ok: false, errorKey: "not-permitted" };
  return { ok: false, errorKey: "request-failed" };
}

export async function deactivateJuntoMember(
  supabase: SupabaseServerClient,
  juntoId: string,
  membershipId: string,
  actingUserId: string,
): Promise<AdminWriteResult> {
  if (!z.uuid().safeParse(membershipId).success) {
    return { ok: false, errorKey: "request-failed" };
  }
  const { data, error } = await supabase
    .from("junto_members")
    .update({ status: "inactive" })
    .eq("id", membershipId)
    .eq("junto_id", juntoId)
    .neq("user_id", actingUserId)
    .select("id");
  if (error?.code === "42501") return { ok: false, errorKey: "not-permitted" };
  if (error || !Array.isArray(data) || data.length !== 1) {
    return { ok: false, errorKey: "request-failed" };
  }
  return { ok: true };
}
