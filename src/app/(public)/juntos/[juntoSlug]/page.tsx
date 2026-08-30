import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicEssayList } from "@/components/public-essay-list";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { juntoSlugSchema } from "@/lib/env";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import { formatMeetingDate, meetingDisplayName } from "@/lib/meeting-domain";
import { getPublicJunto, listPublicMeetings } from "@/lib/meetings";
import { publicJuntoMetadata } from "@/lib/public-seo";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import homeStyles from "../../page.module.css";
import styles from "../../publication.module.css";

export const dynamic = "force-dynamic";

const loadChapter = cache(async (juntoSlug: string) => {
  if (!juntoSlugSchema.safeParse(juntoSlug).success) return null;
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const junto = await getPublicJunto(supabase, juntoSlug, signal);
    if (!junto) return null;
    const [essays, meetings] = await Promise.all([
      listPublicEssays(supabase, { juntoSlug, limit: 24, signal }),
      listPublicMeetings(supabase, { juntoSlug, limit: 12, signal }),
    ]);
    return { junto, essays, meetings };
  } catch {
    return null;
  }
});

interface PageProps {
  params: Promise<{ juntoSlug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const chapter = await loadChapter((await params).juntoSlug);
  return publicJuntoMetadata(chapter?.junto ?? null, siteConfig().siteUrl);
}

export default async function PublicJuntoPage({ params }: PageProps) {
  const chapter = await loadChapter((await params).juntoSlug);
  if (!chapter) notFound();

  const featuredMeeting =
    chapter.meetings.find((meeting) =>
      chapter.essays.some((essay) => essay.meetingDate === meeting.meetingDate),
    ) ?? chapter.meetings[0];
  const featuredEssays = featuredMeeting
    ? chapter.essays.filter(
        (essay) => essay.meetingDate === featuredMeeting.meetingDate,
      )
    : [];

  return (
    <article className={homeStyles.frontPage}>
      <header>
        <p className={styles.metaLabel}>Public Junto chapter</p>
        <h1>{chapter.junto.name}</h1>
        <p className={styles.lede}>
          {chapter.junto.description ??
            "Essays and proceedings this chapter has chosen to place in the public record."}
        </p>
        <Link
          className={styles.contextLink}
          href={routes.essayArchive({ juntoSlug: chapter.junto.slug })}
        >
          Browse this chapter in the essay archive
        </Link>
      </header>

      {featuredMeeting ? (
        <section
          className={homeStyles.feature}
          aria-labelledby="chapter-featured-meeting"
        >
          <p className={homeStyles.kicker}>
            Meeting proceedings ·{" "}
            <time dateTime={featuredMeeting.meetingDate}>
              {formatMeetingDate(featuredMeeting.meetingDate)}
            </time>
          </p>
          <h2
            className={homeStyles.featureDisplay}
            id="chapter-featured-meeting"
          >
            {meetingDisplayName(featuredMeeting) ??
              `Meeting of ${formatMeetingDate(featuredMeeting.meetingDate)}`}
          </h2>
          {featuredMeeting.description ? (
            <p className={homeStyles.lede}>{featuredMeeting.description}</p>
          ) : null}
          <Link
            className={homeStyles.featureLink}
            href={routes.publicMeeting(
              featuredMeeting.juntoSlug,
              featuredMeeting.meetingDate,
            )}
          >
            Read the meeting record
          </Link>
          {featuredEssays.length > 0 ? (
            <PublicEssayList essays={featuredEssays.slice(0, 4)} />
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="chapter-recent-essays">
        <div className={homeStyles.sectionHeading}>
          <h2 id="chapter-recent-essays">Recent public essays</h2>
          <Link href={routes.essayArchive({ juntoSlug: chapter.junto.slug })}>
            Chapter archive
          </Link>
        </div>
        <div className={styles.sectionBody}>
          {chapter.essays.length > 0 ? (
            <PublicEssayList essays={chapter.essays.slice(0, 8)} />
          ) : (
            <p className={styles.empty}>
              This chapter&apos;s public essay record is quiet for now.
            </p>
          )}
        </div>
      </section>

      {chapter.meetings.length > 0 ? (
        <section aria-labelledby="chapter-recent-meetings">
          <h2 id="chapter-recent-meetings">Recent meetings</h2>
          <ul className={styles.archiveList}>
            {chapter.meetings.slice(0, 6).map((meeting) => (
              <li className={styles.archiveRow} key={meeting.meetingDate}>
                <p className={styles.metaLabel}>
                  <time dateTime={meeting.meetingDate}>
                    {formatMeetingDate(meeting.meetingDate)}
                  </time>
                </p>
                <Link
                  className={styles.archiveLink}
                  href={routes.publicMeeting(
                    meeting.juntoSlug,
                    meeting.meetingDate,
                  )}
                >
                  {meetingDisplayName(meeting) ??
                    `Meeting of ${formatMeetingDate(meeting.meetingDate)}`}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
