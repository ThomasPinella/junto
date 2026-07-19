import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { MarkdownContent } from "@/components/markdown-content";
import { PublicEssayList } from "@/components/public-essay-list";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { essaySlugSchema } from "@/lib/essay-domain";
import {
  getPublicEssayBySlug,
  listPublicEssays,
  publicReadSignal,
} from "@/lib/essays";
import { formatMeetingDate } from "@/lib/meeting-domain";
import {
  estimateReadingMinutes,
  relatedPublicEssays,
} from "@/lib/public-archive-domain";
import { publicEssayMetadata } from "@/lib/public-seo";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "../../publication.module.css";

export const dynamic = "force-dynamic";

const loadEssay = cache(async (essaySlug: string) => {
  if (!essaySlugSchema.safeParse(essaySlug).success) return null;
  try {
    const site = siteConfig();
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const [essay, eligibleEssays] = await Promise.all([
      getPublicEssayBySlug(supabase, essaySlug, site.initialJuntoSlug, signal),
      listPublicEssays(supabase, {
        juntoSlug: site.initialJuntoSlug,
        limit: 100,
        signal,
      }),
    ]);
    if (!essay) return null;
    return { essay, related: relatedPublicEssays(essay, eligibleEssays) };
  } catch {
    return null;
  }
});

interface PageProps {
  params: Promise<{ essaySlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const record = await loadEssay((await params).essaySlug);
  return publicEssayMetadata(record?.essay ?? null, siteConfig().siteUrl);
}

export default async function EssayPage({ params }: PageProps) {
  const record = await loadEssay((await params).essaySlug);
  if (!record) notFound();
  const { essay, related } = record;
  return (
    <article className={styles.essayPage}>
      <header className={styles.essayHeader}>
        {essay.meetingDate ? (
          <Link
            className={styles.meetingContext}
            href={routes.publicMeeting(essay.juntoSlug, essay.meetingDate)}
          >
            {essay.meetingTitle ?? "Meeting"} ·{" "}
            <time dateTime={essay.meetingDate}>
              {formatMeetingDate(essay.meetingDate)}
            </time>
          </Link>
        ) : null}
        <h1>{essay.title}</h1>
        {essay.subtitle ? (
          <p className={styles.essaySubtitle}>{essay.subtitle}</p>
        ) : null}
        <p className={styles.essayByline}>
          By{" "}
          <Link href={routes.author(essay.authorSlug)}>{essay.authorName}</Link>
        </p>
        <p className={styles.essayMeta}>
          <time dateTime={essay.publishedAt}>
            Published{" "}
            {new Date(essay.publishedAt).toLocaleDateString("en-US", {
              dateStyle: "long",
              timeZone: "UTC",
            })}
          </time>{" "}
          · {estimateReadingMinutes(essay.bodyMarkdown)} min read
        </p>
      </header>
      <MarkdownContent
        markdown={essay.bodyMarkdown}
        className={styles.essayBody}
      />

      {related.moreByAuthor.length > 0 ? (
        <section
          className={styles.trailingSection}
          aria-labelledby="more-by-author"
        >
          <h2 id="more-by-author">More from {essay.authorName}</h2>
          <div className={styles.sectionBody}>
            <PublicEssayList essays={related.moreByAuthor} />
          </div>
        </section>
      ) : null}
      {related.moreFromMeeting.length > 0 ? (
        <section
          className={styles.trailingSection}
          aria-labelledby="more-from-meeting"
        >
          <h2 id="more-from-meeting">Other essays from the meeting</h2>
          <div className={styles.sectionBody}>
            <PublicEssayList essays={related.moreFromMeeting} />
          </div>
        </section>
      ) : null}
    </article>
  );
}
