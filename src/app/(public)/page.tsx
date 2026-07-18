import Link from "next/link";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

import styles from "./page.module.css";

// The homepage is the configured initial chapter's publication front
// (docs/design/surface-guidelines.md §1). T01 establishes the editorial
// posture only; meeting-led features arrive with real meeting data (T04+).
export default function HomePage() {
  const site = siteConfig();
  return (
    <article>
      <p className={styles.label}>The {site.initialChapterName} chapter</p>
      <h1 className={styles.display}>
        Essays written for the table, kept for the public record.
      </h1>
      <p className={styles.lede}>
        Junto is a recurring, in-person essay practice. Each member writes an
        essay, reads it aloud at a meeting of the chapter, and discusses it with
        the group around a table. The essays their authors choose to publish are
        collected here.
      </p>
      <hr className={styles.rule} />
      <section aria-labelledby="from-the-meetings">
        <h2 id="from-the-meetings">From the meetings</h2>
        <p className={styles.note}>
          The archive opens as the chapter&rsquo;s first essays are published.
          Each meeting gathers the essays read at that table &mdash; browse the{" "}
          <Link href={routes.essays}>essay archive</Link>, the{" "}
          <Link href={routes.meetings}>meetings</Link>, and the{" "}
          <Link href={routes.authors}>authors</Link>, or read{" "}
          <Link href={routes.about}>about the practice</Link>.
        </p>
      </section>
    </article>
  );
}
