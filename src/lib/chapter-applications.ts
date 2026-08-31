import "server-only";

import { z } from "zod";

import {
  chapterApplicationWriteErrorKey,
  type ApplicationDecisionInput,
  type ChapterApplicationInput,
  type ChapterApplicationWriteErrorKey,
} from "@/lib/chapter-application-domain";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const submittedRowSchema = z.object({
  application_id: z.uuid().nullable(),
  stored: z.boolean(),
});

const applicationRowSchema = z.object({
  application_id: z.uuid(),
  chapter_name: z.string(),
  application_location: z.string(),
  applicant_email: z.email(),
  intent_note: z.string(),
  application_status: z.enum(["pending", "approved", "declined"]),
  created_at: z.string(),
  reviewed_at: z.string().nullable(),
  junto_id: z.uuid().nullable(),
  junto_slug: z.string().nullable(),
});

const decisionRowSchema = z.object({
  application_id: z.uuid(),
  application_status: z.enum(["approved", "declined"]),
  applicant_email: z.email(),
  chapter_name: z.string(),
  chapter_id: z.uuid().nullable(),
  chapter_slug: z.string().nullable(),
});

export interface ChapterApplication {
  id: string;
  chapterName: string;
  location: string;
  applicantEmail: string;
  intentNote: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  reviewedAt: string | null;
  juntoId: string | null;
  juntoSlug: string | null;
}

export type SubmitApplicationResult =
  | { ok: true; applicationId: string | null; stored: boolean }
  | { ok: false; errorKey: ChapterApplicationWriteErrorKey };

export async function submitChapterApplication(
  supabase: SupabaseServerClient,
  input: ChapterApplicationInput,
): Promise<SubmitApplicationResult> {
  const { data, error } = await supabase.rpc("submit_chapter_application", {
    application_chapter_name: input.chapterName,
    application_location: input.location,
    application_email: input.applicantEmail,
    application_intent_note: input.intentNote,
    application_website: input.website,
  });
  if (error) {
    const errorKey = chapterApplicationWriteErrorKey(error);
    return {
      ok: false,
      errorKey: errorKey === "slug-taken" ? "already-pending" : errorKey,
    };
  }
  const parsed = z.array(submittedRowSchema).safeParse(data);
  const row =
    parsed.success && parsed.data.length === 1 ? parsed.data[0] : null;
  if (!row || (row.stored && !row.application_id)) {
    return { ok: false, errorKey: "request-failed" };
  }
  return {
    ok: true,
    applicationId: row.application_id,
    stored: row.stored,
  };
}

export async function listChapterApplications(
  supabase: SupabaseServerClient,
): Promise<ChapterApplication[]> {
  const { data, error } = await supabase.rpc("list_chapter_applications");
  if (error) {
    throw new Error(`Chapter application lookup failed (${error.code ?? "?"})`);
  }
  return z
    .array(applicationRowSchema)
    .parse(data ?? [])
    .map((row) => ({
      id: row.application_id,
      chapterName: row.chapter_name,
      location: row.application_location,
      applicantEmail: row.applicant_email,
      intentNote: row.intent_note,
      status: row.application_status,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      juntoId: row.junto_id,
      juntoSlug: row.junto_slug,
    }));
}

export type DecideApplicationResult =
  | {
      ok: true;
      applicationId: string;
      status: "approved" | "declined";
      applicantEmail: string;
      chapterName: string;
      chapterId: string | null;
      chapterSlug: string | null;
    }
  | { ok: false; errorKey: ChapterApplicationWriteErrorKey };

export async function decideChapterApplication(
  supabase: SupabaseServerClient,
  input: ApplicationDecisionInput,
): Promise<DecideApplicationResult> {
  const { data, error } = await supabase.rpc("decide_chapter_application", {
    target_application_id: input.applicationId,
    application_decision: input.decision,
    approved_chapter_slug: input.chapterSlug,
  });
  if (error) {
    const errorKey = chapterApplicationWriteErrorKey(error);
    return {
      ok: false,
      errorKey: errorKey === "already-pending" ? "slug-taken" : errorKey,
    };
  }
  const parsed = z.array(decisionRowSchema).safeParse(data);
  const row =
    parsed.success && parsed.data.length === 1 ? parsed.data[0] : null;
  if (!row) return { ok: false, errorKey: "request-failed" };
  return {
    ok: true,
    applicationId: row.application_id,
    status: row.application_status,
    applicantEmail: row.applicant_email,
    chapterName: row.chapter_name,
    chapterId: row.chapter_id,
    chapterSlug: row.chapter_slug,
  };
}
