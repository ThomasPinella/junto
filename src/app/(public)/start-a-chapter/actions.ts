"use server";

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { notifyReviewerOfApplication } from "@/lib/chapter-application-email";
import { parseChapterApplicationForm } from "@/lib/chapter-application-domain";
import { submitChapterApplication } from "@/lib/chapter-applications";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

function applicationUrl(
  kind: "error" | "status",
  value: string,
): `/start-a-chapter?${string}` {
  return `${routes.startChapter}?${kind}=${encodeURIComponent(value)}`;
}

export async function submitApplication(formData: FormData): Promise<void> {
  const parsed = parseChapterApplicationForm(formData);
  if (!parsed.ok) redirect(applicationUrl("error", parsed.errorKey));

  // Public behavior is identical with or without an Auth cookie. This client
  // intentionally carries the anon key only; the RPC is the complete write
  // capability and returns no application data.
  const result = await submitChapterApplication(
    createSupabaseAnonClient(),
    parsed.input,
  );
  if (!result.ok) redirect(applicationUrl("error", result.errorKey));

  if (!result.stored) {
    redirect(applicationUrl("status", "submitted"));
  }

  const notification = await notifyReviewerOfApplication(parsed.input);
  redirect(
    applicationUrl(
      "status",
      notification.ok ? "submitted" : "submitted-notification-failed",
    ),
  );
}
