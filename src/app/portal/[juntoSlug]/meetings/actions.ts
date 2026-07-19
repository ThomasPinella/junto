"use server";

// Meeting administration actions. Every action re-authenticates the caller,
// re-authorizes the SELECTED Junto's live admin membership on this request,
// validates all external input at the boundary, and writes through the
// anon/user client so Row Level Security remains the final authority — the
// bound juntoSlug/meetingId arguments are routing input, never trusted, and
// junto_id always comes from the server-derived membership. Errors surface
// as safe message keys; no action can ever issue a DELETE.

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import {
  meetingStatusSchema,
  parseMeetingForm,
  type MeetingStatus,
} from "@/lib/meeting-domain";
import {
  createJuntoMeeting,
  setJuntoMeetingStatus,
  updateJuntoMeeting,
} from "@/lib/meetings";
import { requireJuntoAdmin } from "@/lib/portal-access";

export async function createMeeting(
  juntoSlug: string,
  formData: FormData,
): Promise<void> {
  const { supabase, membership } = await requireJuntoAdmin(juntoSlug);
  const formUrl = routes.portalMeetingNew(membership.juntoSlug);
  const parsed = parseMeetingForm(formData);
  if (!parsed.ok) {
    redirect(`${formUrl}?error=${parsed.errorKey}`);
  }
  const result = await createJuntoMeeting(
    supabase,
    membership.juntoId,
    parsed.input,
  );
  if (!result.ok) {
    redirect(`${formUrl}?error=${result.errorKey}`);
  }
  redirect(
    `${routes.portalMeeting(membership.juntoSlug, result.id)}?status=created`,
  );
}

export async function updateMeeting(
  juntoSlug: string,
  meetingId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, membership } = await requireJuntoAdmin(juntoSlug);
  const formUrl = routes.portalMeetingEdit(membership.juntoSlug, meetingId);
  const parsed = parseMeetingForm(formData);
  if (!parsed.ok) {
    redirect(`${formUrl}?error=${parsed.errorKey}`);
  }
  const result = await updateJuntoMeeting(
    supabase,
    membership.juntoId,
    meetingId,
    parsed.input,
  );
  if (!result.ok) {
    redirect(`${formUrl}?error=${result.errorKey}`);
  }
  redirect(
    `${routes.portalMeeting(membership.juntoSlug, meetingId)}?status=updated`,
  );
}

const STATUS_CONFIRMATIONS: Record<MeetingStatus, string> = {
  upcoming: "reopened",
  completed: "marked-completed",
  cancelled: "cancelled",
  archived: "archived",
};

export async function transitionMeetingStatus(
  juntoSlug: string,
  meetingId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, membership } = await requireJuntoAdmin(juntoSlug);
  const formUrl = routes.portalMeetingEdit(membership.juntoSlug, meetingId);
  const parsedStatus = meetingStatusSchema.safeParse(formData.get("status"));
  if (!parsedStatus.success) {
    redirect(`${formUrl}?error=request-failed`);
  }
  // Archiving is deliberate: it requires the explicit confirmation control,
  // never a bare button press.
  if (
    parsedStatus.data === "archived" &&
    formData.get("confirm-archive") !== "on"
  ) {
    redirect(`${formUrl}?error=archive-confirm`);
  }
  const result = await setJuntoMeetingStatus(
    supabase,
    membership.juntoId,
    meetingId,
    parsedStatus.data,
  );
  if (!result.ok) {
    redirect(`${formUrl}?error=${result.errorKey}`);
  }
  redirect(
    `${routes.portalMeeting(membership.juntoSlug, meetingId)}?status=${STATUS_CONFIRMATIONS[parsedStatus.data]}`,
  );
}
