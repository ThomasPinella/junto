"use client";

import styles from "../../content.module.css";
import essayStyles from "./essays.module.css";

// Protected failures stay deliberately quiet: no record identifiers, query
// details, or private metadata reach the response.
export default function EssayWorkspaceError({ reset }: { reset: () => void }) {
  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>The writing room is unavailable</h1>
      <p className={styles.problem} role="alert">
        Nothing private has been shown. Check the essay’s current state before
        trying again.
      </p>
      <button className={essayStyles.quietButton} onClick={reset} type="button">
        Try again
      </button>
    </article>
  );
}
