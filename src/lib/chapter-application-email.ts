import "server-only";

import { routes } from "@/config/routes";
import { CHAPTER_APPLICATION_REVIEWER_EMAIL } from "@/lib/chapter-application-domain";
import { loadResendEnv, loadSiteEnv } from "@/lib/env";

export const CHAPTER_APPLICATION_SENDER =
  "Junto <applications@thomaspinella.com>";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type NotificationResult = { ok: true } | { ok: false };

async function sendEmail(message: EmailMessage): Promise<NotificationResult> {
  try {
    const { RESEND_API_KEY } = loadResendEnv();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CHAPTER_APPLICATION_SENDER,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    return response.ok ? { ok: true } : { ok: false };
  } catch {
    // The database write is already durable. Callers surface this bounded
    // failure without logging credentials or private application content.
    return { ok: false };
  }
}

export async function notifyReviewerOfApplication(input: {
  chapterName: string;
  location: string;
  applicantEmail: string;
  intentNote: string;
}): Promise<NotificationResult> {
  const reviewUrl = new URL(
    routes.portalApplications,
    loadSiteEnv().NEXT_PUBLIC_SITE_URL,
  );
  return sendEmail({
    to: CHAPTER_APPLICATION_REVIEWER_EMAIL,
    subject: `New Junto chapter application: ${input.chapterName}`,
    text: [
      `Chapter: ${input.chapterName}`,
      `Location: ${input.location}`,
      `Applicant: ${input.applicantEmail}`,
      "",
      input.intentNote,
      "",
      `Review this application: ${reviewUrl.toString()}`,
      "Decisions can only be made after signing in on the review page.",
    ].join("\n"),
  });
}

export async function notifyApplicantOfDecision(input: {
  applicantEmail: string;
  chapterName: string;
  decision: "approved" | "declined";
}): Promise<NotificationResult> {
  if (input.decision === "declined") {
    return sendEmail({
      to: input.applicantEmail,
      subject: `Your Junto chapter application`,
      text: `Thank you for proposing ${input.chapterName}. We are not moving forward with this chapter application at this time.`,
    });
  }
  const signInUrl = new URL(
    routes.portalSignIn,
    loadSiteEnv().NEXT_PUBLIC_SITE_URL,
  );
  return sendEmail({
    to: input.applicantEmail,
    subject: `Your Junto chapter application was approved`,
    text: [
      `Your application for ${input.chapterName} was approved.`,
      "",
      "Use the email address that received this message to request Junto's one-time sign-in link:",
      signInUrl.toString(),
      "",
      "Opening that verified magic link will claim your pending administrator invitation and open your chapter.",
    ].join("\n"),
  });
}
