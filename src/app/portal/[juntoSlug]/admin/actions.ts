"use server";

import { redirect } from "next/navigation";

import {
  createJuntoInvitation,
  deactivateJuntoMember,
} from "@/lib/membership-admin";
import { parseInvitationForm } from "@/lib/membership-domain";
import { requireJuntoAdmin } from "@/lib/portal-access";

function adminUrl(
  juntoSlug: string,
  key: "error" | "status",
  value: string,
): `/portal/${string}` {
  return `/portal/${encodeURIComponent(juntoSlug)}/admin?${key}=${encodeURIComponent(value)}`;
}

export async function inviteMember(
  juntoSlug: string,
  formData: FormData,
): Promise<void> {
  const { supabase, membership } = await requireJuntoAdmin(juntoSlug);
  const parsed = parseInvitationForm(formData);
  if (!parsed.ok) {
    redirect(adminUrl(membership.juntoSlug, "error", parsed.errorKey));
  }
  const result = await createJuntoInvitation(
    supabase,
    membership.juntoId,
    parsed.input,
  );
  if (!result.ok) {
    redirect(adminUrl(membership.juntoSlug, "error", result.errorKey));
  }
  redirect(adminUrl(membership.juntoSlug, "status", "invited"));
}

export async function deactivateMember(
  juntoSlug: string,
  membershipId: string,
): Promise<void> {
  const { supabase, membership, userId } = await requireJuntoAdmin(juntoSlug);
  const result = await deactivateJuntoMember(
    supabase,
    membership.juntoId,
    membershipId,
    userId,
  );
  if (!result.ok) {
    redirect(adminUrl(membership.juntoSlug, "error", result.errorKey));
  }
  redirect(adminUrl(membership.juntoSlug, "status", "deactivated"));
}
