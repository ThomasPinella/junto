import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import { listPublicJuntos, listPublicMeetings } from "@/lib/meetings";
import { buildPublicSitemap } from "@/lib/public-sitemap";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteConfig();
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const [chapters, essays, meetings] = await Promise.all([
      listPublicJuntos(supabase, signal),
      listPublicEssays(supabase, { limit: 100, signal }),
      listPublicMeetings(supabase, { limit: 100, signal }),
    ]);
    return buildPublicSitemap(site.siteUrl, chapters, essays, meetings);
  } catch {
    return [];
  }
}
