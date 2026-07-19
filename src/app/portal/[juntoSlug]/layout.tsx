import Link from "next/link";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";
import { portalNavItems } from "@/lib/portal-nav";
import { requireJuntoMembership } from "@/lib/portal-access";

import { SignOutButton } from "../sign-out-button";

import styles from "./layout.module.css";

// The selected Junto's portal shell: JUNTO identity, explicit members-only
// language, the selected chapter and the member's role IN THAT CHAPTER,
// role-scoped navigation, a switcher across the member's other active
// memberships, and sign-out. The layout authorizes for full page loads;
// every page below re-checks the live membership itself, so client-side
// navigation can never outlive a deactivation.
export default async function JuntoPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ juntoSlug: string }>;
}) {
  const { juntoSlug } = await params;
  const { membership, memberships } = await requireJuntoMembership(juntoSlug);
  const navItems = portalNavItems(membership.juntoSlug, membership.role);

  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <div className={styles.masthead}>
          <div>
            <p className={styles.wordmark}>
              <Link className={styles.wordmarkLink} href={routes.home}>
                JUNTO
              </Link>
            </p>
            <p className={styles.portalLabel}>
              Member Portal · Junto members only
            </p>
          </div>
          <div className={styles.context}>
            <p className={styles.juntoName}>{membership.juntoName}</p>
            <p className={styles.role}>
              {membership.role === "admin"
                ? "You are an admin of this Junto."
                : "You are a member of this Junto."}
            </p>
          </div>
          <SignOutButton />
        </div>
        <div className={styles.bars}>
          <nav aria-label="Portal">
            <ul className={styles.navList}>
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link className={styles.navLink} href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {memberships.length > 1 ? (
            <nav aria-label="Your Juntos" className={styles.switcher}>
              <span className={styles.switcherLabel}>Your Juntos</span>
              <ul className={styles.switcherList}>
                {memberships.map((candidate) => (
                  <li key={candidate.membershipId}>
                    <Link
                      aria-current={
                        candidate.juntoId === membership.juntoId
                          ? "true"
                          : undefined
                      }
                      className={styles.switcherLink}
                      href={routes.portalJunto(candidate.juntoSlug)}
                    >
                      {candidate.juntoName}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </header>
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
