import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownContent } from "@/components/markdown-content";
import { routes } from "@/config/routes";
import { essayStatusLabel, essayVisibilityLabel } from "@/lib/essay-domain";
import { getOwnJuntoEssay } from "@/lib/essays";
import { requireJuntoMembership } from "@/lib/portal-access";

import content from "../../../../content.module.css";
import styles from "../../essays.module.css";

export const metadata: Metadata = {
  title: "Essay preview",
  robots: { index: false, follow: false },
};

export default async function EssayPreviewPage({
  params,
}: {
  params: Promise<{ juntoSlug: string; essayId: string }>;
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

  return (
    <article className={styles.savedPreview}>
      <p className={content.label}>Author preview · Junto members only</p>
      <dl className={styles.stateSummary}>
        <div>
          <dt>Publication status</dt>
          <dd>{essayStatusLabel(essay.status)}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{essayVisibilityLabel(essay.visibility)}</dd>
        </div>
      </dl>
      <h1 className={styles.readingTitle}>{essay.title}</h1>
      {essay.subtitle ? (
        <p className={styles.readingSubtitle}>{essay.subtitle}</p>
      ) : null}
      <div className={styles.readingBody}>
        <MarkdownContent markdown={essay.bodyMarkdown} />
      </div>
      <nav aria-label="Essay preview actions" className={styles.previewActions}>
        <Link href={routes.portalEssayEdit(membership.juntoSlug, essay.id)}>
          Return to editor
        </Link>
        <Link href={routes.portalEssays(membership.juntoSlug)}>
          All your essays
        </Link>
      </nav>
    </article>
  );
}
