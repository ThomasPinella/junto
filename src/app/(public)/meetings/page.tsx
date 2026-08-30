import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { publicReadSignal } from "@/lib/essays";
import {
  formatMeetingDate,
  meetingDisplayName,
  meetingStatusLabel,
  type PublicMeeting,
} from "@/lib/meeting-domain";
import {
  listPublicJuntos,
  listPublicMeetings,
  type PublicJunto,
} from "@/lib/meetings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "../publication.module.css";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

interface PublicMeetingRecord {
  junto: PublicJunto;
  meeting: PublicMeeting;
}

async function loadPublicMeetings(): Promise<PublicMeetingRecord[] | null> {
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const [chapters, meetings] = await Promise.all([
      listPublicJuntos(supabase, signal),
      listPublicMeetings(supabase, { limit: 100, signal }),
    ]);
    const chaptersBySlug = new Map(
      chapters.map((chapter) => [chapter.slug, chapter]),
    );
    return meetings.flatMap((meeting) => {
      const junto = chaptersBySlug.get(meeting.juntoSlug);
      return junto ? [{ junto, meeting }] : [];
    });
  } catch {
    return null;
  }
}

export default async function MeetingsPage() {
  const records = await loadPublicMeetings();

  return (
    <article>
      <p className={styles.metaLabel}>Network proceedings</p>
      <h1>Meetings</h1>
      <p className={styles.lede}>
        Meetings give the archive its rhythm: a chapter, a date, a table, and
        the essays read aloud that evening.
      </p>
      <hr className={styles.rule} />
      {records && records.length > 0 ? (
        <ul className={styles.archiveList}>
          {records.map(({ junto, meeting }) => {
            const name = meetingDisplayName(meeting);
            return (
              <li
                className={styles.archiveRow}
                key={`${meeting.juntoSlug}\0${meeting.meetingDate}`}
              >
                <p className={styles.metaLabel}>
                  <Link href={routes.junto(junto.slug)}>{junto.name}</Link>
                  {" · "}
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
                  {name ??
                    `Meeting of ${formatMeetingDate(meeting.meetingDate)}`}
                </Link>
                <span className={styles.archiveStatus}>
                  {meetingStatusLabel(meeting.status)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty}>
          No public meeting records yet. Eligible proceedings will appear here.
        </p>
      )}
    </article>
  );
}
