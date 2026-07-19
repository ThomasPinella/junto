import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  formatMeetingDate,
  meetingDateSchema,
  meetingDisplayName,
  meetingStatusLabel,
  type PublicMeeting,
} from "@/lib/meeting-domain";
import {
  getPublicJunto,
  getPublicMeetingByDate,
  type PublicJunto,
} from "@/lib/meetings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import styles from "../../../../publication.module.css";

// A public record renders per request, never from a stale prerender.
export const dynamic = "force-dynamic";

interface PublicMeetingRecord {
  junto: PublicJunto;
  meeting: PublicMeeting;
}

// The canonical public meeting page (docs/content/meetings.md):
// /juntos/[juntoSlug]/meetings/[meetingDate]. Every miss — private Junto,
// inactive Junto, nonexistent Junto, absent or malformed date, or a
// momentary archive failure — resolves to the SAME not-found, and reads use
// a cookie-free anon client against the safe projection only, so nothing
// distinguishes "private" from "never existed".
const loadRecord = cache(
  async (
    juntoSlug: string,
    meetingDate: string,
  ): Promise<PublicMeetingRecord | null> => {
    if (!meetingDateSchema.safeParse(meetingDate).success) {
      return null;
    }
    try {
      const supabase = createSupabaseAnonClient();
      const junto = await getPublicJunto(supabase, juntoSlug);
      if (!junto) {
        return null;
      }
      const meeting = await getPublicMeetingByDate(
        supabase,
        juntoSlug,
        meetingDate,
      );
      return meeting ? { junto, meeting } : null;
    } catch {
      return null;
    }
  },
);

interface RouteParams {
  params: Promise<{ juntoSlug: string; meetingDate: string }>;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { juntoSlug, meetingDate } = await params;
  const record = await loadRecord(juntoSlug, meetingDate);
  if (!record) {
    // Generic metadata for every miss; no probe can learn whether a private
    // record exists behind this URL.
    return { title: "Meeting" };
  }
  return {
    title: `Meeting of ${formatMeetingDate(record.meeting.meetingDate)} · ${record.junto.name}`,
  };
}

const PUBLIC_STATUS_NOTES: Partial<Record<PublicMeeting["status"], string>> = {
  cancelled: "This meeting was cancelled.",
  archived: "This meeting is part of the chapter's archived record.",
};

export default async function PublicMeetingPage({ params }: RouteParams) {
  const { juntoSlug, meetingDate } = await params;
  const record = await loadRecord(juntoSlug, meetingDate);
  if (!record) {
    notFound();
  }
  const { junto, meeting } = record;
  const name = meetingDisplayName(meeting);
  const statusNote = PUBLIC_STATUS_NOTES[meeting.status];

  return (
    <article>
      <p className={styles.metaLabel}>
        {junto.name} &middot;{" "}
        <time dateTime={meeting.meetingDate}>
          {formatMeetingDate(meeting.meetingDate)}
        </time>{" "}
        &middot; {meetingStatusLabel(meeting.status)}
      </p>
      <h1>{name ?? `Meeting of ${formatMeetingDate(meeting.meetingDate)}`}</h1>
      {meeting.title && meeting.theme ? (
        <p className={styles.lede}>Theme: {meeting.theme}</p>
      ) : null}
      {statusNote ? <p className={styles.statusNote}>{statusNote}</p> : null}
      {meeting.description ? (
        <div className={styles.recordBody}>
          <p>{meeting.description}</p>
        </div>
      ) : null}
      <hr className={styles.rule} />
      <section aria-labelledby="meeting-essays">
        <h2 id="meeting-essays">Essays from this meeting</h2>
        <p className={styles.empty}>
          Essays their authors publish from this meeting will appear here.
        </p>
      </section>
    </article>
  );
}
