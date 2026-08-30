import type { MetadataRoute } from "next";

import { routes } from "@/config/routes";
import type { PublicEssay } from "@/lib/essay-domain";
import type { PublicMeeting } from "@/lib/meeting-domain";
import type { PublicJunto } from "@/lib/meetings";

export function buildPublicSitemap(
  siteUrl: string,
  chapters: PublicJunto[],
  essays: PublicEssay[],
  meetings: PublicMeeting[],
): MetadataRoute.Sitemap {
  const absolute = (path: string) => new URL(path, siteUrl).toString();
  const latestByAuthor = new Map<string, string>();
  for (const essay of essays) {
    const current = latestByAuthor.get(essay.authorSlug);
    if (!current || essay.publishedAt > current) {
      latestByAuthor.set(essay.authorSlug, essay.publishedAt);
    }
  }
  return [
    { url: absolute(routes.home) },
    { url: absolute(routes.essays) },
    { url: absolute(routes.authors) },
    { url: absolute(routes.meetings) },
    ...chapters.map((chapter) => ({
      url: absolute(routes.junto(chapter.slug)),
    })),
    ...essays.map((essay) => ({
      url: absolute(routes.essay(essay.slug)),
      lastModified: new Date(essay.publishedAt),
    })),
    ...[...latestByAuthor].map(([slug, updated]) => ({
      url: absolute(routes.author(slug)),
      lastModified: new Date(updated),
    })),
    ...meetings.map((meeting) => ({
      url: absolute(
        routes.publicMeeting(meeting.juntoSlug, meeting.meetingDate),
      ),
    })),
  ];
}
