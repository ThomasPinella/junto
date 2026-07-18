import type { Metadata } from "next";

import styles from "../publication.module.css";

export const metadata: Metadata = {
  title: "Essay archive",
};

// Future essay pages live under /essays/[essaySlug]
// (src/config/routes.ts); this shell must not invent a competing shape.
export default function EssayArchivePage() {
  return (
    <article>
      <h1>Essay archive</h1>
      <p className={styles.lede}>
        Essays published by Junto members, each tied to the meeting where it was
        read aloud and discussed.
      </p>
      <hr className={styles.rule} />
      <p className={styles.empty}>
        No essays have been published yet. As members publish, their essays
        appear here &mdash; browsable by recent publication, by author, and by
        meeting.
      </p>
    </article>
  );
}
