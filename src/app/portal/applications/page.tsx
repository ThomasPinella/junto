import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { deriveChapterSlug } from "@/lib/chapter-application-domain";
import { listChapterApplications } from "@/lib/chapter-applications";
import { requireApplicationReviewer } from "@/lib/portal-access";

import content from "../content.module.css";
import { PortalFrame } from "../frame";
import { SignOutButton } from "../sign-out-button";
import formStyles from "../[juntoSlug]/meetings/meetings.module.css";
import { approveApplication, declineApplication } from "./actions";

import styles from "./page.module.css";

export const metadata: Metadata = { title: "Chapter applications" };

const STATUS_MESSAGES: Record<string, string> = {
  approved:
    "The application was approved. The private chapter and pending administrator invitation were created, and the applicant was notified.",
  "approved-notification-failed":
    "The application was approved and the private chapter and administrator invitation were created, but the applicant notification could not be delivered.",
  declined: "The application was declined and the applicant was notified.",
  "declined-notification-failed":
    "The application was declined, but the applicant notification could not be delivered.",
};

const ERROR_MESSAGES: Record<string, string> = {
  "application-invalid": "Choose a valid pending application.",
  "slug-invalid":
    "Use 1–63 lowercase letters or numbers separated by single hyphens.",
  "slug-taken": "That chapter URL is already in use. Choose another slug.",
  "input-invalid":
    "The application is no longer pending or the decision is invalid.",
  "not-permitted": "Reviewer access is required.",
  "request-failed": "Nothing was changed. Try again in a moment.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChapterApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireApplicationReviewer();
  const [applications, params] = await Promise.all([
    listChapterApplications(supabase),
    searchParams,
  ]);
  const status = firstValue(params.status);
  const error = firstValue(params.error);
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <PortalFrame aside={<SignOutButton />}>
      <article>
        <p className={content.label}>Reviewer only</p>
        <h1 className={content.title}>Chapter applications</h1>
        <div className={content.body}>
          <p>
            Approval creates a private active chapter and a pending admin
            invitation together. The applicant still proves mailbox ownership
            through Junto&rsquo;s existing magic-link sign-in.
          </p>
        </div>
        {statusMessage ? (
          <p className={content.notice} role="status">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className={content.problem} role="alert">
            {errorMessage}
          </p>
        ) : null}
        {applications.length === 0 ? (
          <p className={styles.empty}>There are no chapter applications yet.</p>
        ) : (
          <ol className={styles.list}>
            {applications.map((application) => (
              <li className={styles.row} key={application.id}>
                <header className={styles.rowHeader}>
                  <div>
                    <h2 className={styles.name}>{application.chapterName}</h2>
                    <p className={styles.location}>{application.location}</p>
                  </div>
                  <p className={styles.status}>{application.status}</p>
                </header>
                <p className={styles.email}>{application.applicantEmail}</p>
                <p className={styles.note}>{application.intentNote}</p>
                <p className={styles.date}>
                  Submitted{" "}
                  {new Date(application.createdAt).toLocaleDateString("en-US")}
                </p>
                {application.status === "pending" ? (
                  <div className={styles.actions}>
                    <form
                      action={approveApplication}
                      className={styles.approveForm}
                    >
                      <input
                        name="application-id"
                        type="hidden"
                        value={application.id}
                      />
                      <div className={formStyles.field}>
                        <label
                          className={formStyles.fieldLabel}
                          htmlFor={`slug-${application.id}`}
                        >
                          Chapter URL
                        </label>
                        <input
                          className={formStyles.input}
                          defaultValue={deriveChapterSlug(
                            application.chapterName,
                          )}
                          id={`slug-${application.id}`}
                          maxLength={63}
                          name="chapter-slug"
                          pattern="[a-z0-9]+(-[a-z0-9]+)*"
                          required
                        />
                      </div>
                      <button className={formStyles.submit} type="submit">
                        Approve application
                      </button>
                    </form>
                    <form action={declineApplication}>
                      <input
                        name="application-id"
                        type="hidden"
                        value={application.id}
                      />
                      <button className={formStyles.quietButton} type="submit">
                        Decline application
                      </button>
                    </form>
                  </div>
                ) : application.juntoSlug ? (
                  <p className={styles.result}>
                    Chapter created: {application.juntoSlug}. Applicant
                    invitation remains governed by verified sign-in.{" "}
                    <Link href={routes.portalAdmin(application.juntoSlug)}>
                      Open chapter admin
                    </Link>
                  </p>
                ) : (
                  <p className={styles.result}>Decision recorded.</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </article>
    </PortalFrame>
  );
}
