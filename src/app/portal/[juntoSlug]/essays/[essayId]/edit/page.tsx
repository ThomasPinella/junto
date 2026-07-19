import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { routes } from "@/config/routes";
import { getOwnJuntoEssay } from "@/lib/essays";
import type { Meeting } from "@/lib/meeting-domain";
import { listJuntoMeetings } from "@/lib/meetings";
import { requireJuntoMembership } from "@/lib/portal-access";

import content from "../../../../content.module.css";
import { publishEssay, saveEssay, unpublishEssay } from "../../actions";
import { EssayEditor } from "../../essay-editor";
import styles from "../../essays.module.css";

export const metadata: Metadata = { title: "Edit essay" };

const ERROR_MESSAGES: Record<string, string> = {
  "title-required": "Give the essay a title before saving it.",
  "field-too-long": "One of the fields is too long. Shorten it and try again.",
  "meeting-invalid": "That meeting is not available in this Junto.",
  "visibility-invalid": "Choose Public or Junto members only.",
  "essay-incomplete": "Add a meeting and essay text before publishing.",
  "confirmation-required":
    "Nothing was made public. Confirm that you intend to expose this essay to the internet, then try again.",
  "invalid-transition": "That publication change is not available.",
  "not-permitted": "That essay could not be changed.",
  "request-failed":
    "Something went wrong and the essay was not changed. Try again in a moment.",
};

const STATUS_MESSAGES: Record<string, string> = {
  created: "Draft saved. Its URL slug is now stable.",
  saved: "Essay saved.",
  published: "Essay published.",
  unpublished: "Essay unpublished. It is now an author-only draft.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EditEssayPage({
  params,
  searchParams,
}: {
  params: Promise<{ juntoSlug: string; essayId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { juntoSlug, essayId } = await params;
  const { supabase, membership, userId } =
    await requireJuntoMembership(juntoSlug);
  const essay = await getOwnJuntoEssay(
    supabase,
    membership.juntoId,
    userId,
    essayId,
  );
  if (!essay) notFound();
  let meetings: Meeting[] = [];
  try {
    meetings = await listJuntoMeetings(supabase, membership.juntoId);
  } catch {
    // Existing meeting id remains in the essay even if labels cannot load.
  }
  const query = await searchParams;
  const error = firstValue(query.error);
  const status = firstValue(query.status);
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;

  return (
    <article>
      <p className={content.label}>Writing room · Junto members only</p>
      <h1 className={content.title}>Edit essay</h1>
      {errorMessage ? (
        <p className={content.problem} role="alert">
          {errorMessage}
        </p>
      ) : null}
      {statusMessage ? (
        <p className={content.notice} role="status">
          {statusMessage}
        </p>
      ) : null}
      <p className={styles.stableUrl}>
        Stable slug: <span>{essay.slug}</span>
      </p>
      <EssayEditor
        initialValue={{
          id: essay.id,
          title: essay.title,
          subtitle: essay.subtitle,
          bodyMarkdown: essay.bodyMarkdown,
          meetingId: essay.meetingId,
          status: essay.status,
          visibility: essay.visibility,
          slug: essay.slug,
        }}
        juntoSlug={membership.juntoSlug}
        meetings={meetings}
        publishAction={publishEssay.bind(null, membership.juntoSlug, essay.id)}
        saveAction={saveEssay.bind(null, membership.juntoSlug, essay.id)}
        unpublishAction={unpublishEssay.bind(
          null,
          membership.juntoSlug,
          essay.id,
        )}
      />
      <p className={content.footnote}>
        <Link
          className={styles.textAction}
          href={routes.portalEssays(membership.juntoSlug)}
        >
          Back to your essays
        </Link>
      </p>
    </article>
  );
}
