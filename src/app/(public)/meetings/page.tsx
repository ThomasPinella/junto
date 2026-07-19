import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import {
  formatMeetingDate,
  meetingDisplayName,
  meetingStatusLabel,
  type PublicMeeting,
} from "@/lib/meeting-domain";
import {
  getPublicJunto,
  listPublicMeetings,
  type PublicJunto,
} from "@/lib/meetings";
import { publicReadSignal } from "@/lib/essays";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "../publication.module.css";

export const metadata: Metadata = {
  title: "Meetings",
};

// The archive changes as the chapter meets; render it per request.
export const dynamic = "force-dynamic";

interface PublicArchive {
  junto: PublicJunto;
  meetings: PublicMeeting[];
}

// One uniform quiet outcome whether the configured chapter is private,
// inactive, missing, or the archive is momentarily unreachable: the page
// discloses nothing about why there is no public record. Reads use a
// cookie-free anon client and the safe projection only.
async function loadPublicArchive(
  juntoSlug: string,
): Promise<PublicArchive | null> {
  try {
    const signal = publicReadSignal();
    const supabase = createSupabaseAnonClient();
    const junto = await getPublicJunto(supabase, juntoSlug, signal);
    if (!junto) {
      return null;
    }
    return {
      junto,
      meetings: await listPublicMeetings(supabase, juntoSlug, signal),
    };
  } catch {
    return null;
  }
}

export default async function MeetingsPage() {
  const site = siteConfig();
  const archive = await loadPublicArchive(site.initialJuntoSlug);

  return (
    <article>
      <h1>Meetings</h1>
      <p className={styles.lede}>
        Meetings give the archive its rhythm: a date, a table, and the essays
        read aloud that evening.
        {archive
          ? ` This is the record of ${archive.junto.name}'s gatherings.`
          : ""}
      </p>
      <hr className={styles.rule} />
      {archive && archive.meetings.length > 0 ? (
        <ul className={styles.archiveList}>
          {archive.meetings.map((meeting) => {
            const name = meetingDisplayName(meeting);
            return (
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
          No public meeting records yet. Completed meetings and the published
          essays they gathered will appear here.
        </p>
      )}
    </article>
  );
}
