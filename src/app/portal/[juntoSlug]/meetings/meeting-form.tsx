import { essayDeadlineInputValue, type Meeting } from "@/lib/meeting-domain";

import styles from "./meetings.module.css";

// Shared create/edit meeting form: labeled semantic controls, quiet hints,
// and native validation as a first line — the server action re-validates
// everything (docs/design/surface-guidelines.md §8, "calm and direct").
export function MeetingForm({
  action,
  meeting,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  meeting?: Meeting;
  submitLabel: string;
}) {
  return (
    <form action={action} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="meeting-date">
          Meeting date
        </label>
        <input
          className={styles.input}
          defaultValue={meeting?.meetingDate ?? ""}
          id="meeting-date"
          name="meeting-date"
          required
          type="date"
        />
        <p className={styles.fieldHint}>
          One meeting per date — the date names the gathering&rsquo;s public
          record.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="title">
          Title
        </label>
        <input
          className={styles.input}
          defaultValue={meeting?.title ?? ""}
          id="title"
          maxLength={160}
          name="title"
          type="text"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="theme">
          Theme
        </label>
        <input
          className={styles.input}
          defaultValue={meeting?.theme ?? ""}
          id="theme"
          maxLength={160}
          name="theme"
          type="text"
        />
        <p className={styles.fieldHint}>
          The question or subject the evening gathers around.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="description">
          Description
        </label>
        <textarea
          className={styles.textarea}
          defaultValue={meeting?.description ?? ""}
          id="description"
          maxLength={4000}
          name="description"
        />
        <p className={styles.fieldHint}>
          Shown to members — and to the public record when this chapter&rsquo;s
          archive is public.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="location">
          Location
        </label>
        <input
          className={styles.input}
          defaultValue={meeting?.location ?? ""}
          id="location"
          maxLength={240}
          name="location"
          type="text"
        />
        <p className={styles.fieldHint}>
          Junto members only — the location never appears on public pages.
        </p>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="essay-deadline">
          Essay deadline
        </label>
        <input
          className={styles.input}
          defaultValue={essayDeadlineInputValue(meeting?.essayDeadline ?? null)}
          id="essay-deadline"
          name="essay-deadline"
          type="datetime-local"
        />
        <p className={styles.fieldHint}>
          Optional. Junto members only — deadlines never appear on public pages.
        </p>
      </div>
      <button className={styles.submit} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
