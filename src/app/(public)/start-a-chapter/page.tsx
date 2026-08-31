import type { Metadata } from "next";

import publicationStyles from "../publication.module.css";
import formStyles from "../../portal/[juntoSlug]/meetings/meetings.module.css";

import styles from "./page.module.css";
import { submitApplication } from "./actions";

export const metadata: Metadata = {
  title: "Start a chapter",
  description: "Propose a new local Junto chapter.",
};

const STATUS_MESSAGES: Record<string, string> = {
  submitted:
    "Your application has been received. We will review it and contact you by email.",
  "submitted-notification-failed":
    "Your application was saved, but the reviewer notification could not be delivered. You do not need to submit it again.",
};

const ERROR_MESSAGES: Record<string, string> = {
  "name-invalid": "Enter a chapter name of 120 characters or fewer.",
  "location-invalid": "Enter a city or location of 240 characters or fewer.",
  "email-invalid": "Enter a valid email address.",
  "note-invalid": "Enter a short note of 1,000 characters or fewer.",
  "request-invalid": "Check the application and try again.",
  "input-invalid": "Check the application and try again.",
  "request-failed": "Nothing was submitted. Try again in a moment.",
  "not-permitted": "Nothing was submitted. Try again in a moment.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StartAChapterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = firstValue(params.status);
  const error = firstValue(params.error);
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <article>
      <p className={publicationStyles.metaLabel}>Chapter applications</p>
      <h1>Start a chapter</h1>
      <div className={publicationStyles.lede}>
        <p>
          Propose a local table for serious essays and in-person discussion.
          Keep the note brief: we need only the chapter you imagine, where it
          would meet, and why you want to begin it.
        </p>
      </div>
      {statusMessage ? (
        <p className={styles.notice} role="status">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className={styles.problem} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <form action={submitApplication} className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.fieldLabel} htmlFor="chapter-name">
            Chapter name
          </label>
          <input
            className={formStyles.input}
            id="chapter-name"
            maxLength={120}
            name="chapter-name"
            required
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.fieldLabel} htmlFor="location">
            City or location
          </label>
          <input
            className={formStyles.input}
            id="location"
            maxLength={240}
            name="location"
            required
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.fieldLabel} htmlFor="email">
            Email address
          </label>
          <input
            autoComplete="email"
            className={formStyles.input}
            id="email"
            maxLength={254}
            name="email"
            required
            type="email"
          />
          <p className={formStyles.fieldHint}>
            If approved, this address receives the administrator invitation and
            must verify its mailbox through Junto&rsquo;s sign-in link.
          </p>
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.fieldLabel} htmlFor="intent-note">
            Why this chapter?
          </label>
          <textarea
            className={formStyles.textarea}
            id="intent-note"
            maxLength={1000}
            name="intent-note"
            required
          />
        </div>
        <div aria-hidden="true" className={styles.honeypot}>
          <label htmlFor="website">Website</label>
          <input
            autoComplete="off"
            id="website"
            maxLength={200}
            name="website"
            tabIndex={-1}
          />
        </div>
        <button className={formStyles.submit} type="submit">
          Submit application
        </button>
      </form>
    </article>
  );
}
