import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import { getPublicJunto, listPublicMeetings } from "@/lib/meetings";
import { buildPublicSitemap } from "@/lib/public-sitemap";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteConfig();
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const junto = await getPublicJunto(supabase, site.initialJuntoSlug, signal);
    if (!junto) return [];
    const [essays, meetings] = await Promise.all([
      listPublicEssays(supabase, {
        juntoSlug: junto.slug,
        limit: 100,
        signal,
      }),
      listPublicMeetings(supabase, junto.slug, signal),
    ]);
    return buildPublicSitemap(site.siteUrl, essays, meetings);
  } catch {
    return [];
  }
}
