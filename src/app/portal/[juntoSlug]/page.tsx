import Link from "next/link";

import { routes } from "@/config/routes";
import {
  formatEssayDeadline,
  formatMeetingDate,
  meetingDisplayName,
  todayIsoDate,
} from "@/lib/meeting-domain";
import { getNextJuntoMeeting } from "@/lib/meetings";
import { requireJuntoMembership } from "@/lib/portal-access";

import styles from "../content.module.css";
import meetingStyles from "./meetings/meetings.module.css";

// The portal home supports the chapter's real practice: the next meeting
// and the member's writing come first (docs/design/surface-guidelines.md
// §7). The next meeting is the live nearest genuinely-upcoming gathering of
// THIS Junto — archived, cancelled, and completed meetings never appear
// here, and an empty program is stated honestly.
export default async function JuntoPortalHomePage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { supabase, membership } = await requireJuntoMembership(juntoSlug);
  const nextMeeting = await getNextJuntoMeeting(
    supabase,
    membership.juntoId,
    todayIsoDate(),
  );
  const nextMeetingName = nextMeeting ? meetingDisplayName(nextMeeting) : null;

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>{membership.juntoName}</h1>
      <div className={styles.body}>
        <p>
          This is the chapter&rsquo;s writing room: the private side of Junto
          where the next gathering is prepared and essays take shape.
        </p>
      </div>
      <section aria-labelledby="next-meeting" className={styles.section}>
        <h2 className={styles.sectionLabel} id="next-meeting">
          Next meeting
        </h2>
        {nextMeeting ? (
          <div className={styles.sectionBody}>
            <p className={styles.entryName}>
              <time dateTime={nextMeeting.meetingDate}>
                {formatMeetingDate(nextMeeting.meetingDate)}
              </time>
              {nextMeetingName ? <> &middot; {nextMeetingName}</> : null}
            </p>
            {nextMeeting.location ? <p>{nextMeeting.location}</p> : null}
            {nextMeeting.essayDeadline ? (
              <p>
                Essay deadline:{" "}
                <time dateTime={nextMeeting.essayDeadline}>
                  {formatEssayDeadline(nextMeeting.essayDeadline)}
                </time>
              </p>
            ) : (
              <p className={styles.muted}>No essay deadline set yet.</p>
            )}
            <p>
              <Link
                className={meetingStyles.quietLink}
                href={routes.portalMeeting(
                  membership.juntoSlug,
                  nextMeeting.id,
                )}
              >
                Meeting details
              </Link>
            </p>
          </div>
        ) : (
          <div className={styles.sectionBody}>
            <p>No meeting is scheduled yet.</p>
            <p className={styles.muted}>
              {membership.role === "admin" ? (
                <>
                  Plan the chapter&rsquo;s next gathering from{" "}
                  <Link href={routes.portalMeetings(membership.juntoSlug)}>
                    the meetings page
                  </Link>
                  .
                </>
              ) : (
                <>
                  When the chapter plans its next gathering, its date, theme,
                  and essay deadline will appear here.
                </>
              )}
            </p>
          </div>
        )}
      </section>
      <section aria-labelledby="your-writing" className={styles.section}>
        <h2 className={styles.sectionLabel} id="your-writing">
          Your writing
        </h2>
        <div className={styles.sectionBody}>
          <p>Writing begins with a meeting.</p>
          <p className={styles.muted}>
            {nextMeeting
              ? "Essay drafting for the next gathering arrives here as the writing room ships."
              : "Once a meeting is on the calendar, you will draft, preview, and publish your essay for it from this room."}
          </p>
        </div>
      </section>
    </article>
  );
}
