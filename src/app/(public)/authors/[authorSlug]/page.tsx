import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicEssayList } from "@/components/public-essay-list";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import { formatMeetingDate } from "@/lib/meeting-domain";
import {
  authorSlugSchema,
  buildPublicArchive,
} from "@/lib/public-archive-domain";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { publicAuthorMetadata } from "@/lib/public-seo";

import styles from "../../publication.module.css";

export const dynamic = "force-dynamic";

const loadAuthor = cache(async (authorSlug: string) => {
  if (!authorSlugSchema.safeParse(authorSlug).success) return null;
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const essays = await listPublicEssays(supabase, {
      authorSlug,
      limit: 100,
      signal,
    });
    return buildPublicArchive(essays).authors[0] ?? null;
  } catch {
    return null;
  }
});

interface PageProps {
  params: Promise<{ authorSlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const author = await loadAuthor((await params).authorSlug);
  return publicAuthorMetadata(author, siteConfig().siteUrl);
}

export default async function AuthorPage({ params }: PageProps) {
  const author = await loadAuthor((await params).authorSlug);
  if (!author) notFound();
  return (
    <article>
      <p className={styles.metaLabel}>Author</p>
      <h1>{author.name}</h1>
      <p className={styles.lede}>
        Essays this author has chosen to place in the public Junto record across
        active public chapters.
      </p>
      <a
        className={styles.contextLink}
        href={routes.essayArchive({ authorSlug: author.slug })}
      >
        Browse this author in the essay archive
      </a>
      <hr className={styles.rule} />
      <section aria-labelledby="author-essays">
        <h2 id="author-essays">Public essays</h2>
        <div className={styles.sectionBody}>
          <PublicEssayList essays={author.essays} />
        </div>
      </section>
      {author.meetings.length > 0 ? (
        <section
          className={styles.trailingSection}
          aria-labelledby="author-meetings"
        >
          <h2 id="author-meetings">Meetings represented</h2>
          <ul className={styles.linkList}>
            {author.meetings.map((meeting) => (
              <li key={`${meeting.juntoSlug}\0${meeting.date}`}>
                <Link
                  href={routes.publicMeeting(meeting.juntoSlug, meeting.date)}
                >
                  {meeting.title ?? formatMeetingDate(meeting.date)}
                </Link>
                <span className={styles.linkMeta}>
                  <Link href={routes.junto(meeting.juntoSlug)}>
                    {meeting.juntoName}
                  </Link>{" "}
                  ·{" "}
                  <time dateTime={meeting.date}>
                    {formatMeetingDate(meeting.date)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
