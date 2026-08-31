"use server";

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { notifyApplicantOfDecision } from "@/lib/chapter-application-email";
import { parseApplicationDecisionForm } from "@/lib/chapter-application-domain";
import { decideChapterApplication } from "@/lib/chapter-applications";
import { requireApplicationReviewer } from "@/lib/portal-access";

function applicationsUrl(
  kind: "error" | "status",
  value: string,
): `/portal/applications?${string}` {
  return `${routes.portalApplications}?${kind}=${encodeURIComponent(value)}`;
}

async function decide(
  formData: FormData,
  decision: "approve" | "decline",
): Promise<void> {
  // Server authorization precedes form parsing; the database repeats the
  // verified-email check before inspecting decision inputs.
  const { supabase } = await requireApplicationReviewer();
  const parsed = parseApplicationDecisionForm(formData, decision);
  if (!parsed.ok) redirect(applicationsUrl("error", parsed.errorKey));

  const result = await decideChapterApplication(supabase, parsed.input);
  if (!result.ok) redirect(applicationsUrl("error", result.errorKey));

  const notification = await notifyApplicantOfDecision({
    applicantEmail: result.applicantEmail,
    chapterName: result.chapterName,
    decision: result.status,
  });
  const status = notification.ok
    ? result.status
    : `${result.status}-notification-failed`;
  redirect(applicationsUrl("status", status));
}

export async function approveApplication(formData: FormData): Promise<void> {
  return decide(formData, "approve");
}

export async function declineApplication(formData: FormData): Promise<void> {
  return decide(formData, "decline");
}
