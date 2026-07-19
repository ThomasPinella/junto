import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import {
  essayStatusLabel,
  essayVisibilityLabel,
  type Essay,
} from "@/lib/essay-domain";
import { listOwnEssays } from "@/lib/essays";
import {
  formatMeetingDate,
  meetingDisplayName,
  type Meeting,
} from "@/lib/meeting-domain";
import { listJuntoMeetings } from "@/lib/meetings";
import { requireJuntoMembership } from "@/lib/portal-access";

import content from "../../content.module.css";
import styles from "./essays.module.css";

export const metadata: Metadata = { title: "Essays" };

const EDITED_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function meetingText(essay: Essay, meetings: Map<string, Meeting>): string {
  if (!essay.meetingId) return "Meeting not yet chosen";
  const meeting = meetings.get(essay.meetingId);
  if (!meeting) return "Meeting unavailable";
  const name = meetingDisplayName(meeting) ?? "Open topic";
  return `${formatMeetingDate(meeting.meetingDate)} — ${name}`;
}

export default async function JuntoEssaysPage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { supabase, membership, userId } =
    await requireJuntoMembership(juntoSlug);
  let essays: Essay[] | null = null;
  let meetings: Meeting[] = [];
  try {
    [essays, meetings] = await Promise.all([
      listOwnEssays(supabase, membership.juntoId, userId),
      listJuntoMeetings(supabase, membership.juntoId),
    ]);
  } catch {
    // A protected-data outage is a quiet, non-disclosing state. Never print
    // query details or fall back to an unscoped read.
  }
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  return (
    <article>
      <div className={styles.headingRow}>
        <div>
          <p className={content.label}>Your writing · Junto members only</p>
          <h1 className={content.title}>Essays</h1>
        </div>
        <Link
          className={styles.primaryLink}
          href={routes.portalEssayNew(membership.juntoSlug)}
        >
          Write essay
        </Link>
      </div>
      <div className={content.body}>
        <p>
          Draft for the next table, return to work in progress, or manage what
          you have published.
        </p>
      </div>

      {essays === null ? (
        <p className={content.problem} role="alert">
          Your essays could not be loaded. Nothing private has been shown. Try
          again in a moment.
        </p>
      ) : essays.length === 0 ? (
        <div className={content.notice}>
          <p>You have not begun an essay in this Junto yet.</p>
          <p className={content.muted}>
            Start with a title and meeting; an early draft can remain visible
            only to you.
          </p>
        </div>
      ) : (
        <ol className={styles.essayList}>
          {essays.map((essay) => {
            const isPublic =
              essay.status === "published" && essay.visibility === "public";
            return (
              <li className={styles.essayRow} key={essay.id}>
                <div className={styles.essayMain}>
                  <h2 className={styles.essayTitle}>{essay.title}</h2>
                  <p className={styles.meeting}>
                    {meetingText(essay, meetingById)}
                  </p>
                  <dl className={styles.metadata}>
                    <div>
                      <dt>Status</dt>
                      <dd>{essayStatusLabel(essay.status)}</dd>
                    </div>
                    <div>
                      <dt>Visibility</dt>
                      <dd>{essayVisibilityLabel(essay.visibility)}</dd>
                    </div>
                    <div>
                      <dt>Last edited</dt>
                      <dd>
                        <time dateTime={essay.updatedAt}>
                          {EDITED_FORMAT.format(new Date(essay.updatedAt))}
                        </time>
                      </dd>
                    </div>
                  </dl>
                  {isPublic ? (
                    <p className={styles.publicUrl}>
                      Public URL: <span>{routes.essay(essay.slug)}</span>
                    </p>
                  ) : null}
                </div>
                <nav
                  aria-label={`Actions for ${essay.title}`}
                  className={styles.rowActions}
                >
                  <Link
                    href={routes.portalEssayEdit(
                      membership.juntoSlug,
                      essay.id,
                    )}
                  >
                    Edit
                  </Link>
                  <Link
                    href={routes.portalEssayPreview(
                      membership.juntoSlug,
                      essay.id,
                    )}
                  >
                    Preview
                  </Link>
                </nav>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
