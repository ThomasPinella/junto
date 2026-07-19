import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { routes } from "@/config/routes";
import {
  formatEssayDeadline,
  formatMeetingDate,
  meetingDisplayName,
  meetingStatusLabel,
} from "@/lib/meeting-domain";
import { getJuntoMeeting } from "@/lib/meetings";
import { requireJuntoMembership } from "@/lib/portal-access";

import content from "../../../content.module.css";
import styles from "../meetings.module.css";

export const metadata: Metadata = {
  title: "Meeting",
};

const STATUS_MESSAGES: Record<string, string> = {
  created: "Meeting scheduled.",
  updated: "Meeting details saved.",
  "marked-completed": "Meeting marked completed.",
  cancelled: "Meeting cancelled. It stays on the chapter's record.",
  reopened: "Meeting reopened as upcoming.",
  archived:
    "Meeting archived. It no longer appears among upcoming meetings, but its record remains.",
};

const STATUS_NOTES: Record<string, string> = {
  cancelled: "This meeting was cancelled. Its record remains for the chapter.",
  archived:
    "This meeting is archived: out of the upcoming program, permanently part of the record.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A single gathering's program record for members: full authorized details,
// including the members-only location and essay deadline. Live membership in
// THIS Junto is re-checked, and the lookup is always scoped to the selected
// Junto's id — a meeting of another Junto yields the same not-found as a
// nonexistent one.
export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ juntoSlug: string; meetingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { juntoSlug, meetingId } = await params;
  const { supabase, membership } = await requireJuntoMembership(juntoSlug);
  const meeting = await getJuntoMeeting(
    supabase,
    membership.juntoId,
    meetingId,
  );
  if (!meeting) {
    notFound();
  }
  const status = firstValue((await searchParams).status);
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;
  const statusNote = STATUS_NOTES[meeting.status];
  const name = meetingDisplayName(meeting);

  return (
    <article>
      <p className={content.label}>Junto members only</p>
      <p className={styles.programDate}>
        <time dateTime={meeting.meetingDate}>
          {formatMeetingDate(meeting.meetingDate)}
        </time>
      </p>
      <h1 className={content.title}>
        {name ?? `Meeting of ${formatMeetingDate(meeting.meetingDate)}`}
      </h1>
      {statusMessage ? (
        <p className={content.notice} role="status">
          {statusMessage}
        </p>
      ) : null}
      {statusNote ? <p className={content.problem}>{statusNote}</p> : null}
      <div className={styles.record}>
        {meeting.title && meeting.theme ? (
          <p className={content.muted}>Theme: {meeting.theme}</p>
        ) : null}
        {meeting.description ? (
          <p className={styles.recordDescription}>{meeting.description}</p>
        ) : null}
        <dl className={styles.detailList}>
          <dt>Status</dt>
          <dd>{meetingStatusLabel(meeting.status)}</dd>
          <dt>Location</dt>
          <dd>
            {meeting.location ?? (
              <span className={content.muted}>Not set yet</span>
            )}
          </dd>
          <dt>Essay deadline</dt>
          <dd>
            {meeting.essayDeadline ? (
              <time dateTime={meeting.essayDeadline}>
                {formatEssayDeadline(meeting.essayDeadline)}
              </time>
            ) : (
              <span className={content.muted}>Not set yet</span>
            )}
          </dd>
        </dl>
        <p className={content.muted}>
          Location and essay deadline are Junto members only; they never appear
          on public pages.
        </p>
      </div>
      <div className={styles.actionRow}>
        {membership.role === "admin" ? (
          <Link
            className={styles.actionLink}
            href={routes.portalMeetingEdit(membership.juntoSlug, meeting.id)}
          >
            Edit meeting
          </Link>
        ) : null}
        <Link
          className={styles.quietLink}
          href={routes.portalMeetings(membership.juntoSlug)}
        >
          All meetings
        </Link>
      </div>
    </article>
  );
}
