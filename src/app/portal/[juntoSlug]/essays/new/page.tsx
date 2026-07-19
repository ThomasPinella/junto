import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import type { Meeting } from "@/lib/meeting-domain";
import { listJuntoMeetings } from "@/lib/meetings";
import { requireJuntoMembership } from "@/lib/portal-access";

import content from "../../../content.module.css";
import { publishNewEssay, saveNewEssay } from "../actions";
import { EssayEditor } from "../essay-editor";
import styles from "../essays.module.css";

export const metadata: Metadata = { title: "Write an essay" };

const ERROR_MESSAGES: Record<string, string> = {
  "title-required": "Give the essay a title before saving it.",
  "field-too-long": "One of the fields is too long. Shorten it and try again.",
  "visibility-invalid": "Choose Public or Junto members only.",
  "meeting-invalid": "That meeting is not available in this Junto.",
  "essay-incomplete": "Add a meeting and essay text before publishing.",
  "confirmation-required":
    "Confirm that you intend to make this essay public before publishing.",
  "not-permitted": "That essay could not be changed.",
  "slug-taken":
    "A stable URL could not be reserved. Try a more distinctive title.",
  "request-failed":
    "Something went wrong and the essay was not saved. Try again in a moment.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewEssayPage({
  params,
  searchParams,
}: {
  params: Promise<{ juntoSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { juntoSlug } = await params;
  const { supabase, membership } = await requireJuntoMembership(juntoSlug);
  let meetings: Meeting[] = [];
  try {
    meetings = await listJuntoMeetings(supabase, membership.juntoId);
  } catch {
    // The form remains usable for an early unassigned draft.
  }
  const error = firstValue((await searchParams).error);
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <article>
      <p className={content.label}>Writing room · Junto members only</p>
      <h1 className={content.title}>Write an essay</h1>
      <div className={content.body}>
        <p>
          Begin with the meeting and the thought you want to bring to the table.
        </p>
      </div>
      {errorMessage ? (
        <p className={content.problem} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <EssayEditor
        initialValue={{
          title: "",
          subtitle: null,
          bodyMarkdown: "",
          meetingId: null,
          status: "draft",
          visibility: "members_only",
        }}
        juntoSlug={membership.juntoSlug}
        meetings={meetings}
        publishAction={publishNewEssay.bind(null, membership.juntoSlug)}
        saveAction={saveNewEssay.bind(null, membership.juntoSlug)}
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
