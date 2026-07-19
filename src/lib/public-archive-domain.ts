import { z } from "zod";

import { essaySlugSchema, type PublicEssay } from "@/lib/essay-domain";
import { meetingDateSchema } from "@/lib/meeting-domain";

export const authorSlugSchema = essaySlugSchema;

const WORDS_PER_MINUTE = 225;

export function estimateReadingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>|[#>*_`~\[\]()!-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export interface PublicAuthor {
  slug: string;
  name: string;
  essays: PublicEssay[];
  meetings: PublicArchiveMeeting[];
}

export interface PublicArchiveMeeting {
  juntoSlug: string;
  date: string;
  title: string | null;
  essays: PublicEssay[];
  authors: Array<{ slug: string; name: string }>;
}

export interface PublicArchive {
  essays: PublicEssay[];
  authors: PublicAuthor[];
  meetings: PublicArchiveMeeting[];
}

function newestFirst(a: PublicEssay, b: PublicEssay): number {
  return b.publishedAt.localeCompare(a.publishedAt);
}

export function buildPublicArchive(
  eligibleEssays: PublicEssay[],
): PublicArchive {
  const essays = [...eligibleEssays].sort(newestFirst);
  const authorEssays = new Map<string, PublicEssay[]>();
  const meetingEssays = new Map<string, PublicEssay[]>();

  for (const essay of essays) {
    const byAuthor = authorEssays.get(essay.authorSlug) ?? [];
    byAuthor.push(essay);
    authorEssays.set(essay.authorSlug, byAuthor);
    if (essay.meetingDate) {
      const key = `${essay.juntoSlug}\0${essay.meetingDate}`;
      const byMeeting = meetingEssays.get(key) ?? [];
      byMeeting.push(essay);
      meetingEssays.set(key, byMeeting);
    }
  }

  const meetings = [...meetingEssays.values()]
    .map((meetingGroup): PublicArchiveMeeting => {
      const first = meetingGroup[0]!;
      const authors = new Map<string, string>();
      for (const essay of meetingGroup) {
        authors.set(essay.authorSlug, essay.authorName);
      }
      return {
        juntoSlug: first.juntoSlug,
        date: first.meetingDate!,
        title: first.meetingTitle,
        essays: meetingGroup,
        authors: [...authors].map(([slug, name]) => ({ slug, name })),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const authors = [...authorEssays.entries()]
    .map(([slug, authorEssayList]): PublicAuthor => {
      const name = authorEssayList[0]!.authorName;
      const represented = meetings.filter((meeting) =>
        meeting.authors.some((author) => author.slug === slug),
      );
      return { slug, name, essays: authorEssayList, meetings: represented };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { essays, authors, meetings };
}

const archiveFilterSchema = z.strictObject({
  author: authorSlugSchema.optional(),
  meeting: meetingDateSchema.optional(),
});

export interface ArchiveFilters {
  authorSlug?: string;
  meetingDate?: string;
}

export function parseArchiveFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ArchiveFilters | null {
  const parsed = archiveFilterSchema.safeParse(searchParams);
  if (!parsed.success) return null;
  return {
    ...(parsed.data.author ? { authorSlug: parsed.data.author } : {}),
    ...(parsed.data.meeting ? { meetingDate: parsed.data.meeting } : {}),
  };
}

export function relatedPublicEssays(
  current: PublicEssay,
  eligibleEssays: PublicEssay[],
  limit = 3,
): { moreByAuthor: PublicEssay[]; moreFromMeeting: PublicEssay[] } {
  const others = eligibleEssays
    .filter((essay) => essay.slug !== current.slug)
    .sort(newestFirst);
  const moreByAuthor = others
    .filter((essay) => essay.authorSlug === current.authorSlug)
    .slice(0, limit);
  const moreFromMeeting = current.meetingDate
    ? others
        .filter(
          (essay) =>
            essay.juntoSlug === current.juntoSlug &&
            essay.meetingDate === current.meetingDate &&
            essay.authorSlug !== current.authorSlug,
        )
        .slice(0, limit)
    : [];
  return { moreByAuthor, moreFromMeeting };
}
