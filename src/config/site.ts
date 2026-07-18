import "server-only";

import { loadSiteEnv } from "@/lib/env";

// Interim presentation only: until Junto records exist (T02+), the configured
// initial chapter's display name is derived from its slug. Once chapters live
// in the database, their stored display name replaces this.
export function chapterNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface SiteConfig {
  siteUrl: string;
  initialJuntoSlug: string;
  initialChapterName: string;
}

// `/` serves the explicitly configured initial chapter; the configuration
// seam keeps the app multi-Junto from the beginning
// (docs/overview/product-principles.md §1.4).
export function siteConfig(): SiteConfig {
  const env = loadSiteEnv();
  return {
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    initialJuntoSlug: env.JUNTO_INITIAL_JUNTO_SLUG,
    initialChapterName: chapterNameFromSlug(env.JUNTO_INITIAL_JUNTO_SLUG),
  };
}
