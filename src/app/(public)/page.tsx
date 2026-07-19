import Link from "next/link";

import { PublicEssayList } from "@/components/public-essay-list";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";
import {
  formatMeetingDate,
  meetingDisplayName,
  type PublicMeeting,
} from "@/lib/meeting-domain";
import { getPublicJunto, listPublicMeetings } from "@/lib/meetings";
import { buildPublicArchive } from "@/lib/public-archive-domain";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function loadHome(juntoSlug: string) {
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const junto = await getPublicJunto(supabase, juntoSlug, signal);
    if (!junto) return null;
    const [essays, meetings] = await Promise.all([
      listPublicEssays(supabase, { juntoSlug, limit: 24, signal }),
      listPublicMeetings(supabase, juntoSlug, signal),
    ]);
    if (essays.length === 0 && meetings.length === 0) return null;
    return { junto, meetings, archive: buildPublicArchive(essays) };
  } catch {
    return null;
  }
}

function featuredMeeting(
  meetings: PublicMeeting[],
  archiveMeetings: ReturnType<typeof buildPublicArchive>["meetings"],
): {
  meeting: PublicMeeting;
  essays: ReturnType<typeof buildPublicArchive>["essays"];
} | null {
  for (const meeting of meetings) {
    const grouped = archiveMeetings.find(
      (item) => item.date === meeting.meetingDate,
    );
    if (grouped) return { meeting, essays: grouped.essays };
  }
  const meeting = meetings[0];
  return meeting ? { meeting, essays: [] } : null;
}

function QuietPublicationState() {
  return (
    <article>
      <p className={styles.label}>A civic journal written around a table</p>
      <h1 className={styles.display}>The public record is quiet for now.</h1>
      <p className={styles.lede}>
        Junto is a recurring, in-person essay practice. When a chapter makes its
        proceedings public, the essays and meetings appear here.
      </p>
    </article>
  );
}

export default async function HomePage() {
  const site = siteConfig();
  const home = await loadHome(site.initialJuntoSlug);
  if (!home) return <QuietPublicationState />;
  const feature = featuredMeeting(home.meetings, home.archive.meetings);

  return (
    <article className={styles.frontPage}>
      <p className={styles.label}>The {home.junto.name} chapter</p>
      {feature ? (
        <section className={styles.feature} aria-labelledby="featured-meeting">
          <p className={styles.kicker}>
            Featured meeting ·{" "}
            <time dateTime={feature.meeting.meetingDate}>
              {formatMeetingDate(feature.meeting.meetingDate)}
            </time>
          </p>
          <h1 className={styles.display} id="featured-meeting">
            {meetingDisplayName(feature.meeting) ??
              `Meeting of ${formatMeetingDate(feature.meeting.meetingDate)}`}
          </h1>
          {feature.meeting.description ? (
            <p className={styles.lede}>{feature.meeting.description}</p>
          ) : null}
          <Link
            className={styles.featureLink}
            href={routes.publicMeeting(
              feature.meeting.juntoSlug,
              feature.meeting.meetingDate,
            )}
          >
            Read the meeting record
          </Link>
          {feature.essays.length > 0 ? (
            <PublicEssayList essays={feature.essays.slice(0, 4)} />
          ) : null}
        </section>
      ) : (
        <h1 className={styles.display}>
          Essays written for the table, kept for the public record.
        </h1>
      )}

      {home.archive.essays.length > 0 ? (
        <section className={styles.section} aria-labelledby="recent-essays">
          <div className={styles.sectionHeading}>
            <h2 id="recent-essays">Recent essays</h2>
            <Link href={routes.essays}>Full archive</Link>
          </div>
          <PublicEssayList essays={home.archive.essays.slice(0, 6)} />
        </section>
      ) : null}

      <div className={styles.lowerGrid}>
        <section aria-labelledby="recent-meetings">
          <h2 id="recent-meetings">Recent meetings</h2>
          <ul className={styles.simpleList}>
            {home.meetings.slice(0, 4).map((meeting) => (
              <li key={meeting.meetingDate}>
                <Link
                  href={routes.publicMeeting(
                    meeting.juntoSlug,
                    meeting.meetingDate,
                  )}
                >
                  {meetingDisplayName(meeting) ??
                    formatMeetingDate(meeting.meetingDate)}
                </Link>
                <time dateTime={meeting.meetingDate}>
                  {formatMeetingDate(meeting.meetingDate)}
                </time>
              </li>
            ))}
          </ul>
        </section>
        {home.archive.authors.length > 0 ? (
          <section aria-labelledby="participating-authors">
            <h2 id="participating-authors">Participating authors</h2>
            <ul className={styles.simpleList}>
              {home.archive.authors.map((author) => (
                <li key={author.slug}>
                  <Link href={routes.author(author.slug)}>{author.name}</Link>
                  <span>{author.essays[0]?.title}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <section className={styles.practice} aria-labelledby="the-practice">
        <p className={styles.label}>The practice</p>
        <h2 id="the-practice">Writing made for serious conversation.</h2>
        <p>
          Before each gathering, members write an essay that takes a stance or
          makes a claim. They read their work aloud, then discuss it around the
          table. This archive preserves the essays their authors choose to make
          public.
        </p>
        <Link href={routes.about}>About Junto</Link>
      </section>
    </article>
  );
}
