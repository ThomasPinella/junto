import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { requireJuntoMembership } from "@/lib/portal-access";

import styles from "../../content.module.css";

export const metadata: Metadata = {
  title: "Admin",
};

// Admin authority is checked against the SELECTED membership's own role on
// this request — an admin of another Junto is an ordinary member here and is
// turned away (docs/membership/user-roles.md §2).
export default async function JuntoAdminPage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { membership } = await requireJuntoMembership(juntoSlug);
  if (membership.role !== "admin") {
    redirect(routes.portalJunto(membership.juntoSlug));
  }

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>Admin</h1>
      <div className={styles.body}>
        <p>Administration for {membership.juntoName}.</p>
        <p className={styles.muted}>
          Chapter administration — inviting members, planning meetings, and
          managing memberships — arrives here as those features ship in the
          coming tasks.
        </p>
      </div>
    </article>
  );
}
