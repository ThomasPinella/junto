import type { Metadata } from "next";

import styles from "../publication.module.css";

export const metadata: Metadata = {
  title: "About the practice",
};

export default function AboutPage() {
  return (
    <article>
      <h1>About the Junto practice</h1>
      <hr className={styles.rule} />
      <div className={styles.prose}>
        <p>
          Junto is a recurring, in-person discussion practice inspired by
          Benjamin Franklin&rsquo;s original Junto: a small group that meets to
          improve themselves and contribute to society through serious
          conversation about philosophy, politics, morality, personal
          experience, history, and other consequential topics.
        </p>
        <p>
          Each member writes an essay of roughly 750 to 3,500 words that takes a
          stance or makes a claim, reads it aloud at a meeting of the chapter,
          and discusses it with the group for about thirty minutes. Chapters may
          share a meal before the readings.
        </p>
        <p>
          This site is the practice&rsquo;s public record. Members choose what
          to publish: essays marked public appear in this archive, while essays
          marked <strong>Junto members only</strong> stay with the chapter.
          Drafts, discussion, and coordination remain private to the
          chapter&rsquo;s member portal.
        </p>
      </div>
    </article>
  );
}
