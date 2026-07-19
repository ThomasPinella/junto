import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { routes } from "@/config/routes";
import {
  formatMeetingDate,
  meetingDisplayName,
  meetingStatusLabel,
  type Meeting,
} from "@/lib/meeting-domain";
import { getJuntoMeeting } from "@/lib/meetings";
import { requireJuntoAdmin } from "@/lib/portal-access";

import content from "../../../../content.module.css";
import { transitionMeetingStatus, updateMeeting } from "../../actions";
import { MeetingForm } from "../../meeting-form";
import styles from "../../meetings.module.css";

export const metadata: Metadata = {
  title: "Edit meeting",
};

const ERROR_MESSAGES: Record<string, string> = {
  "date-invalid": "Enter a real meeting date.",
  "deadline-invalid": "Enter a valid essay deadline, or leave it blank.",
  "field-too-long": "One of the fields is too long. Shorten it and try again.",
  "date-taken": "This chapter already has a meeting on that date.",
  "not-permitted": "You are not permitted to make that change.",
  "archive-confirm":
    "To archive this meeting, first confirm you understand it leaves the upcoming program.",
  "request-failed":
    "Something went wrong on our side and nothing was changed. Try again in a moment.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusTransitions(meeting: Meeting): Array<{
  status: "upcoming" | "completed" | "cancelled";
  label: string;
}> {
  switch (meeting.status) {
    case "upcoming":
      return [
        { status: "completed", label: "Mark completed" },
        { status: "cancelled", label: "Cancel meeting" },
      ];
    case "completed":
      return [{ status: "upcoming", label: "Reopen as upcoming" }];
    case "cancelled":
      return [{ status: "upcoming", label: "Reopen as upcoming" }];
    case "archived":
      return [{ status: "upcoming", label: "Restore as upcoming" }];
  }
}

// Admin record-keeping for one meeting: edit details, move it through its
// lifecycle, and archive it deliberately. There is no delete — the record
// always survives. Page render and every submitted action independently
// re-check the selected Junto's live admin membership.
export default async function EditMeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ juntoSlug: string; meetingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { juntoSlug, meetingId } = await params;
  const { supabase, membership } = await requireJuntoAdmin(juntoSlug);
  const meeting = await getJuntoMeeting(
    supabase,
    membership.juntoId,
    meetingId,
  );
  if (!meeting) {
    notFound();
  }
  const error = firstValue((await searchParams).error);
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const transition = transitionMeetingStatus.bind(
    null,
    membership.juntoSlug,
    meeting.id,
  );
  const name = meetingDisplayName(meeting);

  return (
    <article>
      <p className={content.label}>Junto members only</p>
      <p className={styles.programDate}>
        <time dateTime={meeting.meetingDate}>
          {formatMeetingDate(meeting.meetingDate)}
        </time>
        {" · "}
        {meetingStatusLabel(meeting.status)}
      </p>
      <h1 className={content.title}>
        Edit{" "}
        {name ?? `the meeting of ${formatMeetingDate(meeting.meetingDate)}`}
      </h1>
      {errorMessage ? (
        <p className={content.problem} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <MeetingForm
        action={updateMeeting.bind(null, membership.juntoSlug, meeting.id)}
        meeting={meeting}
        submitLabel="Save changes"
      />
      <section aria-labelledby="meeting-status" className={content.section}>
        <h2 className={content.sectionLabel} id="meeting-status">
          Record keeping
        </h2>
        <div className={content.sectionBody}>
          <p>
            This meeting is currently{" "}
            <strong>{meetingStatusLabel(meeting.status).toLowerCase()}</strong>.
          </p>
        </div>
        <div className={styles.actionRow}>
          {statusTransitions(meeting).map(({ status, label }) => (
            <form action={transition} key={status}>
              <input name="status" type="hidden" value={status} />
              <button className={styles.quietButton} type="submit">
                {label}
              </button>
            </form>
          ))}
        </div>
      </section>
      {meeting.status !== "archived" ? (
        <section aria-labelledby="archive-meeting" className={content.section}>
          <h2 className={content.sectionLabel} id="archive-meeting">
            Archive
          </h2>
          <div className={content.sectionBody}>
            <p>
              Archiving removes this meeting from the upcoming program while
              keeping its record — and any essays later attached to it — intact.
              Nothing is deleted, and an archived meeting can be restored.
            </p>
          </div>
          <form action={transition} className={styles.form}>
            <input name="status" type="hidden" value="archived" />
            <label className={styles.archiveConfirm} htmlFor="confirm-archive">
              <input
                className={styles.archiveCheckbox}
                id="confirm-archive"
                name="confirm-archive"
                required
                type="checkbox"
              />
              I understand this meeting will leave the upcoming program and
              remain on the chapter&rsquo;s record.
            </label>
            <button className={styles.quietButton} type="submit">
              Archive meeting
            </button>
          </form>
        </section>
      ) : null}
      <p className={content.footnote}>
        <Link
          className={styles.quietLink}
          href={routes.portalMeeting(membership.juntoSlug, meeting.id)}
        >
          Back to the meeting
        </Link>
      </p>
    </article>
  );
}
