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
import {
  listPublicJuntos,
  listPublicMeetings,
  type PublicJunto,
} from "@/lib/meetings";
import { buildPublicArchive } from "@/lib/public-archive-domain";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

async function loadNetwork(initialJuntoSlug: string) {
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const [chapters, essays, initialMeetings] = await Promise.all([
      listPublicJuntos(supabase, signal),
      listPublicEssays(supabase, { limit: 24, signal }),
      listPublicMeetings(supabase, {
        juntoSlug: initialJuntoSlug,
        limit: 12,
        signal,
      }),
    ]);
    return {
      chapters,
      initialMeetings,
      archive: buildPublicArchive(essays),
    };
  } catch {
    return {
      chapters: [],
      initialMeetings: [],
      archive: buildPublicArchive([]),
    };
  }
}

function orderChapters(
  chapters: PublicJunto[],
  initialJuntoSlug: string,
): PublicJunto[] {
  return [...chapters].sort((a, b) => {
    if (a.slug === initialJuntoSlug) return -1;
    if (b.slug === initialJuntoSlug) return 1;
    return a.name.localeCompare(b.name);
  });
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
      (item) =>
        item.juntoSlug === meeting.juntoSlug &&
        item.date === meeting.meetingDate,
    );
    if (grouped) return { meeting, essays: grouped.essays };
  }
  const meeting = meetings[0];
  return meeting ? { meeting, essays: [] } : null;
}

export default async function HomePage() {
  const site = siteConfig();
  const network = await loadNetwork(site.initialJuntoSlug);
  const chapters = orderChapters(network.chapters, site.initialJuntoSlug);
  const initialChapter = chapters.find(
    (chapter) => chapter.slug === site.initialJuntoSlug,
  );
  const feature = initialChapter
    ? featuredMeeting(network.initialMeetings, network.archive.meetings)
    : null;

  return (
    <article className={styles.frontPage}>
      <header>
        <p className={styles.label}>A network of essay chapters</p>
        <h1 className={styles.display}>
          Essays written for the table, kept for the public record.
        </h1>
        <p className={styles.lede}>
          Independent Junto chapters gather around authored thought. This
          archive brings together only the proceedings they choose to publish.
        </p>
      </header>

      <section className={styles.directory} aria-labelledby="public-chapters">
        <div className={styles.sectionHeading}>
          <h2 id="public-chapters">Public chapters</h2>
          <span>Choose a chapter</span>
        </div>
        {chapters.length > 0 ? (
          <ul className={styles.chapterList}>
            {chapters.map((chapter) => (
              <li key={chapter.slug}>
                <Link href={routes.junto(chapter.slug)}>{chapter.name}</Link>
                {chapter.description ? <p>{chapter.description}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>No public chapter record yet.</p>
        )}
      </section>

      {feature && initialChapter ? (
        <section className={styles.feature} aria-labelledby="featured-meeting">
          <p className={styles.kicker}>
            Featured from{" "}
            <Link href={routes.junto(initialChapter.slug)}>
              {initialChapter.name}
            </Link>{" "}
            ·{" "}
            <time dateTime={feature.meeting.meetingDate}>
              {formatMeetingDate(feature.meeting.meetingDate)}
            </time>
          </p>
          <h2 className={styles.featureDisplay} id="featured-meeting">
            {meetingDisplayName(feature.meeting) ??
              `Meeting of ${formatMeetingDate(feature.meeting.meetingDate)}`}
          </h2>
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
      ) : null}

      <section className={styles.section} aria-labelledby="recent-essays">
        <div className={styles.sectionHeading}>
          <h2 id="recent-essays">Recent essays across chapters</h2>
          <Link href={routes.essays}>Full archive</Link>
        </div>
        {network.archive.essays.length > 0 ? (
          <PublicEssayList essays={network.archive.essays.slice(0, 8)} />
        ) : (
          <p className={styles.quiet}>
            The public essay record is quiet for now.
          </p>
        )}
      </section>

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
