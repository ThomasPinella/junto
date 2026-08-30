import type { Metadata } from "next";

import { requireChapterCreator } from "@/lib/portal-access";

import styles from "../../content.module.css";
import formStyles from "../../[juntoSlug]/meetings/meetings.module.css";
import { createChapter } from "./actions";

export const metadata: Metadata = { title: "Create a chapter" };

const ERROR_MESSAGES: Record<string, string> = {
  "name-invalid": "Enter a chapter name of 120 characters or fewer.",
  "slug-invalid":
    "Use 1–63 lowercase letters or numbers, separated only by single hyphens.",
  "description-invalid": "Keep the description to 2,000 characters or fewer.",
  "location-invalid": "Keep the location to 240 characters or fewer.",
  "visibility-invalid": "Choose a valid archive visibility.",
  "slug-taken": "That chapter URL is already in use.",
  "not-permitted": "A live chapter administrator membership is required.",
  "input-invalid": "Check the chapter details and try again.",
  "request-failed": "Nothing was created. Check the details and try again.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewChapterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireChapterCreator();
  const error = firstValue((await searchParams).error);
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <article>
      <p className={styles.label}>Chapter administration</p>
      <h1 className={styles.title}>Create a chapter</h1>
      <div className={styles.body}>
        <p>
          Start a private writing room, then invite its first members from the
          new chapter&rsquo;s Admin area. Your account becomes its first admin.
        </p>
      </div>
      {errorMessage ? (
        <p className={styles.problem} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <form action={createChapter} className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.fieldLabel} htmlFor="chapter-name">
            Chapter name
          </label>
          <input
            className={formStyles.input}
            id="chapter-name"
            maxLength={120}
            name="name"
            required
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.fieldLabel} htmlFor="chapter-slug">
            Chapter URL
          </label>
          <input
            autoCapitalize="none"
            autoCorrect="off"
            className={formStyles.input}
            id="chapter-slug"
            maxLength={63}
            name="slug"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="philadelphia"
            required
          />
          <p className={formStyles.fieldHint}>
            Lowercase letters and numbers separated by hyphens. This becomes the
            chapter&rsquo;s stable portal address.
          </p>
        </div>
        <div className={formStyles.field}>
          <label
            className={formStyles.fieldLabel}
            htmlFor="chapter-description"
          >
            Description
          </label>
          <textarea
            className={formStyles.textarea}
            id="chapter-description"
            maxLength={2000}
            name="description"
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.fieldLabel} htmlFor="chapter-location">
            Location
          </label>
          <input
            className={formStyles.input}
            id="chapter-location"
            maxLength={240}
            name="location"
          />
        </div>
        <div className={formStyles.field}>
          <label
            className={formStyles.fieldLabel}
            htmlFor="chapter-archive-visibility"
          >
            Archive visibility
          </label>
          <select
            className={formStyles.input}
            defaultValue="private"
            id="chapter-archive-visibility"
            name="archive-visibility"
          >
            <option value="private">Junto members only</option>
            <option value="public">Public</option>
          </select>
          <p className={formStyles.fieldHint}>
            New chapters are private by default. Public makes eligible published
            archive material discoverable; member work stays governed by its own
            visibility.
          </p>
        </div>
        <button className={formStyles.submit} type="submit">
          Create chapter
        </button>
      </form>
    </article>
  );
}
