import type { Metadata } from "next";

import { listActiveRoster } from "@/lib/memberships";
import { requireJuntoMembership } from "@/lib/portal-access";

import styles from "../../content.module.css";

export const metadata: Metadata = {
  title: "Members",
};

// The chapter roster (docs/experience/member-portal.md): active members,
// display names, and roles — real data through RLS, and no email addresses.
export default async function JuntoMembersPage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { supabase, membership } = await requireJuntoMembership(juntoSlug);
  const roster = await listActiveRoster(supabase, membership.juntoId);

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>Members</h1>
      <div className={styles.body}>
        <p>
          The active members of {membership.juntoName}. Email addresses stay
          private.
        </p>
      </div>
      <ul className={styles.entryList}>
        {roster.map((member) => (
          <li className={styles.entryRow} key={member.userId}>
            <div>
              <p className={styles.entryName}>{member.displayName}</p>
              {member.bio ? <p className={styles.muted}>{member.bio}</p> : null}
            </div>
            <span className={styles.entryMeta}>
              {member.role === "admin" ? "Admin" : "Member"}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
