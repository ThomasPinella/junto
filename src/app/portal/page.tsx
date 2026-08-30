import Link from "next/link";
import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { requirePortalUser } from "@/lib/portal-access";

import { PortalFrame } from "./frame";
import { SignOutButton } from "./sign-out-button";

import styles from "./content.module.css";

// The private entry/selection route. Access is derived from the
// authenticated user's live active memberships through RLS: one membership
// enters its portal directly, several offer a choice, none is a safe dead
// end with nothing private to see.
export default async function PortalEntryPage() {
  const { memberships } = await requirePortalUser();
  const canCreateChapter = memberships.some(
    (membership) => membership.role === "admin",
  );

  const only = memberships.length === 1 ? memberships[0] : undefined;
  if (only) {
    redirect(routes.portalJunto(only.juntoSlug));
  }

  if (memberships.length === 0) {
    return (
      <PortalFrame aside={<SignOutButton />}>
        <article>
          <p className={styles.label}>Junto members only</p>
          <h1 className={styles.title}>No active memberships</h1>
          <div className={styles.body}>
            <p>
              You are signed in, but this account has no active Junto membership
              right now.
            </p>
            <p>
              If your chapter invited you recently, ask its admin to confirm the
              invitation matches this email address. In the meantime,{" "}
              <Link href={routes.home}>the public archive remains open</Link>.
            </p>
          </div>
        </article>
      </PortalFrame>
    );
  }

  return (
    <PortalFrame aside={<SignOutButton />}>
      <article>
        <p className={styles.label}>Junto members only</p>
        <h1 className={styles.title}>Your Juntos</h1>
        <div className={styles.body}>
          <p>Choose the chapter you want to work in.</p>
        </div>
        <ul className={styles.entryList}>
          {memberships.map((membership) => (
            <li className={styles.entryRow} key={membership.membershipId}>
              <Link
                className={styles.entryLink}
                href={routes.portalJunto(membership.juntoSlug)}
              >
                {membership.juntoName}
              </Link>
              <span className={styles.entryMeta}>
                {membership.role === "admin" ? "Admin" : "Member"}
              </span>
            </li>
          ))}
        </ul>
        {canCreateChapter ? (
          <p className={styles.footnote}>
            Administrate another chapter?{" "}
            <Link href={routes.portalChapterNew}>Create a chapter</Link>.
          </p>
        ) : null}
      </article>
    </PortalFrame>
  );
}
