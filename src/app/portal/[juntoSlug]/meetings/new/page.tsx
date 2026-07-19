import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { requireJuntoAdmin } from "@/lib/portal-access";

import content from "../../../content.module.css";
import { createMeeting } from "../actions";
import { MeetingForm } from "../meeting-form";
import styles from "../meetings.module.css";

export const metadata: Metadata = {
  title: "Schedule a meeting",
};

// Validation failures redirect back here with a safe message key; nothing
// about other chapters or records is ever revealed.
const ERROR_MESSAGES: Record<string, string> = {
  "date-invalid": "Enter a real meeting date.",
  "deadline-invalid": "Enter a valid essay deadline, or leave it blank.",
  "field-too-long": "One of the fields is too long. Shorten it and try again.",
  "date-taken": "This chapter already has a meeting on that date.",
  "not-permitted": "You are not permitted to make that change.",
  "request-failed":
    "Something went wrong on our side and nothing was changed. Try again in a moment.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewMeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ juntoSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { juntoSlug } = await params;
  // Page render AND the submitted action each independently re-check live
  // admin membership of the selected Junto.
  const { membership } = await requireJuntoAdmin(juntoSlug);
  const error = firstValue((await searchParams).error);
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <article>
      <p className={content.label}>Junto members only</p>
      <h1 className={content.title}>Schedule a meeting</h1>
      <div className={content.body}>
        <p>
          Set the date and, when you know them, the theme, description,
          location, and essay deadline for {membership.juntoName}&rsquo;s next
          gathering.
        </p>
      </div>
      {errorMessage ? (
        <p className={content.problem} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <MeetingForm
        action={createMeeting.bind(null, membership.juntoSlug)}
        submitLabel="Schedule meeting"
      />
      <p className={content.footnote}>
        <Link
          className={styles.quietLink}
          href={routes.portalMeetings(membership.juntoSlug)}
        >
          Back to meetings
        </Link>
      </p>
    </article>
  );
}
