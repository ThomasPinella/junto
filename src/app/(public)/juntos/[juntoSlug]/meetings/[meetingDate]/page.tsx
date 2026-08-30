import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicEssayList } from "@/components/public-essay-list";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { juntoSlugSchema } from "@/lib/env";
import { listPublicEssays, publicReadSignal } from "@/lib/essays";

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
  essays: Awaited<ReturnType<typeof listPublicEssays>>;
}

// The canonical public meeting page (docs/content/meetings.md):
// /juntos/[juntoSlug]/meetings/[meetingDate]. Every miss — private, inactive,
// or nonexistent Junto; absent or malformed date; or a
// momentary archive failure — resolves to the SAME not-found, and reads use a
// cookie-free anon client against the safe projection only, so nothing
// distinguishes "private" from "never existed".
const loadRecord = cache(
  async (
    juntoSlug: string,
    meetingDate: string,
  ): Promise<PublicMeetingRecord | null> => {
    if (
      !juntoSlugSchema.safeParse(juntoSlug).success ||
      !meetingDateSchema.safeParse(meetingDate).success
    ) {
      return null;
    }
    try {
      const signal = publicReadSignal();
      const supabase = createSupabaseAnonClient();
      const junto = await getPublicJunto(supabase, juntoSlug, signal);
      if (!junto) {
        return null;
      }
      const [meeting, essays] = await Promise.all([
        getPublicMeetingByDate(supabase, juntoSlug, meetingDate, signal),
        listPublicEssays(supabase, {
          juntoSlug,
          meetingDate,
          limit: 100,
          signal,
        }),
      ]);
      return meeting ? { junto, meeting, essays } : null;
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
    alternates: {
      canonical: new URL(
        routes.publicMeeting(
          record.meeting.juntoSlug,
          record.meeting.meetingDate,
        ),
        siteConfig().siteUrl,
      ).toString(),
    },
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
  const { junto, meeting, essays } = record;
  const name = meetingDisplayName(meeting);
  const statusNote = PUBLIC_STATUS_NOTES[meeting.status];

  return (
    <article>
      <p className={styles.metaLabel}>
        <Link href={routes.junto(junto.slug)}>{junto.name}</Link> &middot;{" "}
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
        <div className={styles.sectionHeadingRow}>
          <h2 id="meeting-essays">Essays from this meeting</h2>
          {essays.length > 0 ? (
            <a
              className={styles.contextLink}
              href={routes.essayArchive({
                juntoSlug: meeting.juntoSlug,
                meetingDate: meeting.meetingDate,
              })}
            >
              Browse in the archive
            </a>
          ) : null}
        </div>
        {essays.length > 0 ? (
          <div className={styles.sectionBody}>
            <PublicEssayList essays={essays} />
          </div>
        ) : (
          <p className={styles.empty}>
            Essays their authors publish from this meeting will appear here.
          </p>
        )}
      </section>
      {essays.length > 0 ? (
        <section
          className={styles.trailingSection}
          aria-labelledby="meeting-authors"
        >
          <h2 id="meeting-authors">Authors</h2>
          <ul className={styles.inlineAuthorList}>
            {[
              ...new Map(
                essays.map((essay) => [essay.authorSlug, essay.authorName]),
              ),
            ].map(([slug, name]) => (
              <li key={slug}>
                <Link href={routes.author(slug)}>{name}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
