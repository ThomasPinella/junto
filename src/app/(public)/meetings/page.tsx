import type { Metadata } from "next";

import styles from "../publication.module.css";

export const metadata: Metadata = {
  title: "Meetings",
};

export default function MeetingsPage() {
  return (
    <article>
      <h1>Meetings</h1>
      <p className={styles.lede}>
        Meetings give the archive its rhythm: a date, a table, and the essays
        read aloud that evening.
      </p>
      <hr className={styles.rule} />
      <p className={styles.empty}>
        No public meeting records yet. Completed meetings and the published
        essays they gathered will appear here.
      </p>
    </article>
  );
}
