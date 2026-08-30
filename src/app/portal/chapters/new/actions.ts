"use server";

import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { parseChapterForm } from "@/lib/chapter-domain";
import { bootstrapChapter } from "@/lib/chapters";
import { requireChapterCreator } from "@/lib/portal-access";

function newChapterUrl(errorKey: string): `/portal/${string}` {
  return `${routes.portalChapterNew}?error=${encodeURIComponent(errorKey)}`;
}

export async function createChapter(formData: FormData): Promise<void> {
  const { supabase } = await requireChapterCreator();
  const parsed = parseChapterForm(formData);
  if (!parsed.ok) redirect(newChapterUrl(parsed.errorKey));

  // The page-level check is only an affordance. bootstrap_junto derives the
  // caller and re-proves live eligibility at the authoritative DB boundary.
  const result = await bootstrapChapter(supabase, parsed.input);
  if (!result.ok) redirect(newChapterUrl(result.errorKey));
  redirect(`${routes.portalAdmin(result.juntoSlug)}?status=chapter-created`);
}
