import type { Metadata } from "next";

import { requireJuntoMembership } from "@/lib/portal-access";

import styles from "../../content.module.css";

export const metadata: Metadata = {
  title: "Essays",
};

// Protected placeholder: the essay workspace is T05/T06. Staged honestly.
export default async function JuntoEssaysPage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  await requireJuntoMembership(juntoSlug);

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>Essays</h1>
      <div className={styles.body}>
        <p>Your drafts and published essays will live here.</p>
        <p className={styles.muted}>
          Essays are written for meetings. Once meetings arrive, this becomes
          your writing desk: drafts, previews, publication, and the choice
          between <strong>Public</strong> and{" "}
          <strong>Junto members only</strong> visibility.
        </p>
      </div>
    </article>
  );
}
