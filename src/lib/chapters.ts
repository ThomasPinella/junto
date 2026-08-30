import "server-only";

import { z } from "zod";

import {
  chapterWriteErrorKey,
  type ChapterInput,
  type ChapterSettingsInput,
  type ChapterWriteErrorKey,
} from "@/lib/chapter-domain";
import type { SupabaseServerClient } from "@/lib/supabase/server";

const bootstrapRowSchema = z.object({
  junto_id: z.uuid(),
  junto_slug: z.string(),
});

const settingsRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  archive_visibility: z.enum(["private", "public"]),
});

export interface ChapterSettings {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  archiveVisibility: "private" | "public";
}

export type ChapterWriteResult =
  | { ok: true; juntoId: string; juntoSlug: string }
  | { ok: false; errorKey: ChapterWriteErrorKey };

export async function bootstrapChapter(
  supabase: SupabaseServerClient,
  input: ChapterInput,
): Promise<ChapterWriteResult> {
  const { data, error } = await supabase.rpc("bootstrap_junto", {
    chapter_name: input.name,
    chapter_slug: input.slug,
    chapter_description: input.description,
    chapter_location: input.location,
    chapter_archive_visibility: input.archiveVisibility,
  });
  if (error) return { ok: false, errorKey: chapterWriteErrorKey(error) };

  const parsed = z.array(bootstrapRowSchema).safeParse(data);
  if (!parsed.success || parsed.data.length !== 1) {
    return { ok: false, errorKey: "request-failed" };
  }
  const row = parsed.data[0];
  if (!row) return { ok: false, errorKey: "request-failed" };
  return { ok: true, juntoId: row.junto_id, juntoSlug: row.junto_slug };
}

export async function getChapterSettings(
  supabase: SupabaseServerClient,
  juntoId: string,
): Promise<ChapterSettings> {
  const { data, error } = await supabase
    .from("juntos")
    .select("id, name, description, location, archive_visibility")
    .eq("id", juntoId)
    .single();
  if (error) {
    throw new Error(`Chapter settings lookup failed (${error.code ?? "?"})`);
  }
  const row = settingsRowSchema.parse(data);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    location: row.location,
    archiveVisibility: row.archive_visibility,
  };
}

export async function updateChapterSettings(
  supabase: SupabaseServerClient,
  juntoId: string,
  input: ChapterSettingsInput,
): Promise<{ ok: true } | { ok: false; errorKey: ChapterWriteErrorKey }> {
  const { data, error } = await supabase
    .from("juntos")
    .update({
      name: input.name,
      description: input.description,
      location: input.location,
      archive_visibility: input.archiveVisibility,
    })
    .eq("id", juntoId)
    .select("id");
  if (error) return { ok: false, errorKey: chapterWriteErrorKey(error) };
  if (!Array.isArray(data) || data.length !== 1) {
    return { ok: false, errorKey: "request-failed" };
  }
  return { ok: true };
}
