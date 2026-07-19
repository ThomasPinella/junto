import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { requireJuntoAdmin } from "@/lib/portal-access";

import styles from "../../content.module.css";
import meetingStyles from "../meetings/meetings.module.css";

export const metadata: Metadata = {
  title: "Admin",
};

// Admin authority is checked against the SELECTED membership's own role on
// this request — an admin of another Junto is an ordinary member here and is
// turned away (docs/membership/user-roles.md §2).
export default async function JuntoAdminPage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { membership } = await requireJuntoAdmin((await params).juntoSlug);

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>Admin</h1>
      <div className={styles.body}>
        <p>Administration for {membership.juntoName}.</p>
      </div>
      <section aria-labelledby="admin-meetings" className={styles.section}>
        <h2 className={styles.sectionLabel} id="admin-meetings">
          Meetings
        </h2>
        <div className={styles.sectionBody}>
          <p>
            Plan the chapter&rsquo;s gatherings: schedule, edit, complete,
            cancel, or archive meetings. Meetings are archived, never deleted —
            the record survives.
          </p>
        </div>
        <div className={meetingStyles.actionRow}>
          <Link
            className={meetingStyles.actionLink}
            href={routes.portalMeetingNew(membership.juntoSlug)}
          >
            Schedule a meeting
          </Link>
          <Link
            className={meetingStyles.quietLink}
            href={routes.portalMeetings(membership.juntoSlug)}
          >
            Manage meetings
          </Link>
        </div>
      </section>
      <section aria-labelledby="admin-coming" className={styles.section}>
        <h2 className={styles.sectionLabel} id="admin-coming">
          Coming
        </h2>
        <div className={styles.sectionBody}>
          <p className={styles.muted}>
            Inviting members and managing memberships arrive here as those
            features ship in the coming tasks.
          </p>
        </div>
      </section>
    </article>
  );
}
