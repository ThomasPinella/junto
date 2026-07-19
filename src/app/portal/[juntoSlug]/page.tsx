import { requireJuntoMembership } from "@/lib/portal-access";

import styles from "../content.module.css";

// The portal home supports the chapter's real practice: the next meeting
// and the member's writing come first (docs/design/surface-guidelines.md
// §7). Meetings and essays arrive in later tasks, so their places are
// clearly staged — never manufactured.
export default async function JuntoPortalHomePage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { membership } = await requireJuntoMembership(juntoSlug);

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
        <div className={styles.sectionBody}>
          <p>No meeting is scheduled yet.</p>
          <p className={styles.muted}>
            When the chapter plans its next gathering, its date, theme, and
            essay deadline will appear here.
          </p>
        </div>
      </section>
      <section aria-labelledby="your-writing" className={styles.section}>
        <h2 className={styles.sectionLabel} id="your-writing">
          Your writing
        </h2>
        <div className={styles.sectionBody}>
          <p>Writing begins with a meeting.</p>
          <p className={styles.muted}>
            Once a meeting is on the calendar, you will draft, preview, and
            publish your essay for it from this room.
          </p>
        </div>
      </section>
    </article>
  );
}
