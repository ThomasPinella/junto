import type { Metadata } from "next";

import { getOwnProfile } from "@/lib/profiles";
import { requireJuntoMembership } from "@/lib/portal-access";

import styles from "../../content.module.css";

export const metadata: Metadata = {
  title: "Profile",
};

// Read-only profile basics for now; editing arrives with a later task.
export default async function JuntoProfilePage({
  params,
}: {
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { supabase, userId, membership } =
    await requireJuntoMembership(juntoSlug);
  const profile = await getOwnProfile(supabase, userId);

  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>Profile</h1>
      <div className={styles.body}>
        {profile ? (
          <>
            <p>
              You appear to other members of {membership.juntoName} as{" "}
              <strong>{profile.displayName}</strong>.
            </p>
            {profile.bio ? (
              <p>{profile.bio}</p>
            ) : (
              <p className={styles.muted}>You have not added a bio yet.</p>
            )}
          </>
        ) : (
          <p className={styles.muted}>Your profile has not been set up yet.</p>
        )}
        <p className={styles.muted}>
          Profile editing is coming; your display name and bio will be
          adjustable here.
        </p>
      </div>
    </article>
  );
}
