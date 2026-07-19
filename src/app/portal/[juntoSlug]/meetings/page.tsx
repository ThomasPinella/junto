import type { Metadata } from "next";

import { requireJuntoMembership } from "@/lib/portal-access";

import styles from "../../content.module.css";

export const metadata: Metadata = {
  title: "Meetings",
};

// Protected placeholder: meetings are T04. Staged honestly, never invented.
export default async function JuntoMeetingsPage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  await requireJuntoMembership(juntoSlug);

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>Meetings</h1>
      <div className={styles.body}>
        <p>No meetings are scheduled yet.</p>
        <p className={styles.muted}>
          Meetings are the chapter&rsquo;s heartbeat: each gathering collects
          the essays written for it. When your chapter schedules one, it will
          appear here.
        </p>
      </div>
    </article>
  );
}
