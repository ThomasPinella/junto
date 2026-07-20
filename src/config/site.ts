import "server-only";

import { loadSiteEnv } from "@/lib/env";

// The configured initial Junto keeps a URL-safe slug while its masthead uses
// a readable chapter label. Stored Junto data supplies the full record on
// data-backed pages.
export function chapterNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function chapterLabelFromSlug(slug: string): string {
  return `${chapterNameFromSlug(slug)} Chapter`;
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
    initialChapterName: chapterLabelFromSlug(env.JUNTO_INITIAL_JUNTO_SLUG),
  };
}
