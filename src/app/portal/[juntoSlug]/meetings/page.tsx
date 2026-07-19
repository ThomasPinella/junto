import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import {
  formatMeetingDate,
  groupMeetings,
  meetingDisplayName,
  meetingStatusLabel,
  todayIsoDate,
  type Meeting,
} from "@/lib/meeting-domain";
import { listJuntoMeetings } from "@/lib/meetings";
import { requireJuntoMembership } from "@/lib/portal-access";

import content from "../../content.module.css";
import styles from "./meetings.module.css";

export const metadata: Metadata = {
  title: "Meetings",
};

function ProgramRow({
  juntoSlug,
  meeting,
  showStatus,
}: {
  juntoSlug: string;
  meeting: Meeting;
  showStatus: boolean;
}) {
  const name = meetingDisplayName(meeting);
  return (
    <li className={styles.programRow}>
      <p className={styles.programDate}>
        <time dateTime={meeting.meetingDate}>
          {formatMeetingDate(meeting.meetingDate)}
        </time>
      </p>
      <Link
        className={styles.programLink}
        href={routes.portalMeeting(juntoSlug, meeting.id)}
      >
        {name ?? `Meeting of ${formatMeetingDate(meeting.meetingDate)}`}
      </Link>
      {showStatus ? (
        <span className={styles.programStatusQuiet}>
          {meetingStatusLabel(meeting.status)}
        </span>
      ) : null}
    </li>
  );
}

// The chapter's meeting program: the upcoming gatherings first, then the
// honest historical record — completed, cancelled, and archived alike.
// Live membership is re-checked on this request; admin controls appear only
// for the selected Junto's own admins.
export default async function JuntoMeetingsPage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { supabase, membership } = await requireJuntoMembership(juntoSlug);
  const meetings = await listJuntoMeetings(supabase, membership.juntoId);
  const groups = groupMeetings(meetings, todayIsoDate());
  const isAdmin = membership.role === "admin";

  return (
    <article>
      <p className={content.label}>Junto members only</p>
      <h1 className={content.title}>Meetings</h1>
      <div className={content.body}>
        <p>
          Each gathering of {membership.juntoName} collects the essays written
          for it. The program below is the chapter&rsquo;s record.
        </p>
      </div>
      {isAdmin ? (
        <div className={styles.actionRow}>
          <Link
            className={styles.actionLink}
            href={routes.portalMeetingNew(membership.juntoSlug)}
          >
            Schedule a meeting
          </Link>
        </div>
      ) : null}
      <section aria-labelledby="upcoming-meetings" className={content.section}>
        <h2 className={content.sectionLabel} id="upcoming-meetings">
          Upcoming
        </h2>
        {groups.upcoming.length > 0 ? (
          <ul className={styles.programList}>
            {groups.upcoming.map((meeting) => (
              <ProgramRow
                juntoSlug={membership.juntoSlug}
                key={meeting.id}
                meeting={meeting}
                showStatus={false}
              />
            ))}
          </ul>
        ) : (
          <div className={content.sectionBody}>
            <p>No meetings are scheduled yet.</p>
            <p className={content.muted}>
              {isAdmin
                ? "Schedule the chapter's next gathering to open its program."
                : "When your chapter schedules its next gathering, it will appear here."}
            </p>
          </div>
        )}
      </section>
      <section aria-labelledby="meeting-history" className={content.section}>
        <h2 className={content.sectionLabel} id="meeting-history">
          Past &amp; records
        </h2>
        {groups.history.length > 0 ? (
          <ul className={styles.programList}>
            {groups.history.map((meeting) => (
              <ProgramRow
                juntoSlug={membership.juntoSlug}
                key={meeting.id}
                meeting={meeting}
                showStatus
              />
            ))}
          </ul>
        ) : (
          <div className={content.sectionBody}>
            <p className={content.muted}>No past meetings are on record yet.</p>
          </div>
        )}
      </section>
    </article>
  );
}
