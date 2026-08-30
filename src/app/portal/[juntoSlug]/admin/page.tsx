import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { getChapterSettings } from "@/lib/chapters";
import { listJuntoInvitations } from "@/lib/membership-admin";
import { listActiveRoster } from "@/lib/memberships";
import { requireJuntoAdmin } from "@/lib/portal-access";

import styles from "../../content.module.css";
import meetingStyles from "../meetings/meetings.module.css";
import { deactivateMember, inviteMember, saveChapterSettings } from "./actions";

export const metadata: Metadata = {
  title: "Admin",
};

const ERROR_MESSAGES: Record<string, string> = {
  "email-invalid": "Enter a valid email address.",
  "role-invalid": "Choose Member or Admin.",
  "confirmation-required":
    "Confirm that this person is approved before creating the invitation.",
  "already-pending": "That email already has a pending invitation.",
  "not-permitted": "You are not permitted to make that change.",
  "request-failed": "Nothing was changed. Check the details and try again.",
  "name-invalid": "Enter a chapter name of 120 characters or fewer.",
  "description-invalid": "Keep the description to 2,000 characters or fewer.",
  "location-invalid": "Keep the location to 240 characters or fewer.",
  "visibility-invalid": "Choose a valid archive visibility.",
  "input-invalid": "Check the chapter details and try again.",
};

const STATUS_MESSAGES: Record<string, string> = {
  invited:
    "Invitation created. The approved person can now request a sign-in link.",
  deactivated: "Membership deactivated. Private access is revoked immediately.",
  "chapter-created":
    "Chapter created privately. You are its first admin; invite its approved members below.",
  "settings-saved": "Chapter settings saved.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Admin authority is checked against the SELECTED membership's own role on
// this request — an admin of another Junto is an ordinary member here and is
// turned away (docs/membership/user-roles.md §2).
export default async function JuntoAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ juntoSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, membership, userId } = await requireJuntoAdmin(
    (await params).juntoSlug,
  );
  const [invitations, roster, chapter] = await Promise.all([
    listJuntoInvitations(supabase, membership.juntoId),
    listActiveRoster(supabase, membership.juntoId),
    getChapterSettings(supabase, membership.juntoId),
  ]);
  const query = await searchParams;
  const error = firstValue(query.error);
  const status = firstValue(query.status);
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>Admin</h1>
      <div className={styles.body}>
        <p>Administration for {membership.juntoName}.</p>
      </div>
      {errorMessage ? (
        <p className={styles.problem} role="alert">
          {errorMessage}
        </p>
      ) : null}
      {statusMessage ? (
        <p className={styles.notice} role="status">
          {statusMessage}
        </p>
      ) : null}
      <section aria-labelledby="admin-settings" className={styles.section}>
        <h2 className={styles.sectionLabel} id="admin-settings">
          Chapter settings
        </h2>
        <div className={styles.sectionBody}>
          <p>
            These settings apply only to the selected chapter. Status, deletion,
            and ownership are not managed here.
          </p>
        </div>
        <form
          action={saveChapterSettings.bind(null, membership.juntoSlug)}
          className={meetingStyles.form}
        >
          <div className={meetingStyles.field}>
            <label className={meetingStyles.fieldLabel} htmlFor="settings-name">
              Chapter name
            </label>
            <input
              className={meetingStyles.input}
              defaultValue={chapter.name}
              id="settings-name"
              maxLength={120}
              name="name"
              required
            />
          </div>
          <div className={meetingStyles.field}>
            <label
              className={meetingStyles.fieldLabel}
              htmlFor="settings-description"
            >
              Description
            </label>
            <textarea
              className={meetingStyles.textarea}
              defaultValue={chapter.description ?? ""}
              id="settings-description"
              maxLength={2000}
              name="description"
            />
          </div>
          <div className={meetingStyles.field}>
            <label
              className={meetingStyles.fieldLabel}
              htmlFor="settings-location"
            >
              Location
            </label>
            <input
              className={meetingStyles.input}
              defaultValue={chapter.location ?? ""}
              id="settings-location"
              maxLength={240}
              name="location"
            />
          </div>
          <div className={meetingStyles.field}>
            <label
              className={meetingStyles.fieldLabel}
              htmlFor="settings-archive-visibility"
            >
              Archive visibility
            </label>
            <select
              className={meetingStyles.input}
              defaultValue={chapter.archiveVisibility}
              id="settings-archive-visibility"
              name="archive-visibility"
            >
              <option value="private">Junto members only</option>
              <option value="public">Public</option>
            </select>
          </div>
          <button className={meetingStyles.submit} type="submit">
            Save chapter settings
          </button>
        </form>
      </section>
      <section aria-labelledby="admin-invitations" className={styles.section}>
        <h2 className={styles.sectionLabel} id="admin-invitations">
          Invitations
        </h2>
        <div className={styles.sectionBody}>
          <p>
            Allowlist one approved email address. The invitation becomes a
            membership only after that mailbox completes the genuine sign-in
            link flow.
          </p>
        </div>
        <form
          action={inviteMember.bind(null, membership.juntoSlug)}
          className={meetingStyles.form}
        >
          <div className={meetingStyles.field}>
            <label className={meetingStyles.fieldLabel} htmlFor="invite-email">
              Email address
            </label>
            <input
              autoComplete="email"
              className={meetingStyles.input}
              id="invite-email"
              name="email"
              required
              type="email"
            />
          </div>
          <div className={meetingStyles.field}>
            <label className={meetingStyles.fieldLabel} htmlFor="invite-role">
              Role
            </label>
            <select
              className={meetingStyles.input}
              defaultValue="member"
              id="invite-role"
              name="role"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <label className={meetingStyles.archiveConfirm}>
            <input
              className={meetingStyles.archiveCheckbox}
              name="confirm-invitation"
              required
              type="checkbox"
            />
            <span>
              I confirm this person is approved to join this Junto with the
              selected role.
            </span>
          </label>
          <button className={meetingStyles.submit} type="submit">
            Invite a member
          </button>
        </form>
        {invitations.length > 0 ? (
          <ul className={styles.entryList}>
            {invitations.map((invitation) => (
              <li className={styles.entryRow} key={invitation.id}>
                <span className={styles.entryName}>{invitation.email}</span>
                <span className={styles.entryMeta}>
                  {invitation.role} · {invitation.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section aria-labelledby="admin-memberships" className={styles.section}>
        <h2 className={styles.sectionLabel} id="admin-memberships">
          Active memberships
        </h2>
        <ul className={styles.entryList}>
          {roster.map((member) => (
            <li className={styles.entryRow} key={member.membershipId}>
              <div>
                <p className={styles.entryName}>{member.displayName}</p>
                <p className={styles.entryMeta}>{member.role}</p>
              </div>
              {member.userId !== userId ? (
                <form
                  action={deactivateMember.bind(
                    null,
                    membership.juntoSlug,
                    member.membershipId,
                  )}
                >
                  <button className={meetingStyles.quietButton} type="submit">
                    Deactivate {member.displayName}
                  </button>
                </form>
              ) : (
                <span className={styles.entryMeta}>You</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="admin-meetings" className={styles.section}>
        <h2 className={styles.sectionLabel} id="admin-meetings">
          Meetings
        </h2>
        <div className={styles.sectionBody}>
          <p>
            Plan the chapter&rsquo;s gatherings: schedule, edit, complete,
            cancel, or archive meetings. Meetings are archived, never deleted —
            the record survives.
          </p>
        </div>
        <div className={meetingStyles.actionRow}>
          <Link
            className={meetingStyles.actionLink}
            href={routes.portalMeetingNew(membership.juntoSlug)}
          >
            Schedule a meeting
          </Link>
          <Link
            className={meetingStyles.quietLink}
            href={routes.portalMeetings(membership.juntoSlug)}
          >
            Manage meetings
          </Link>
        </div>
      </section>
    </article>
  );
}
