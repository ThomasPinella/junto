import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";

import styles from "./layout.module.css";

// The portal is a private surface: keep it out of search indexes
// (docs/overview/product-principles.md §1.3).
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Portal posture per docs/design/surface-guidelines.md §7: denser and more
// functional than the public masthead, but a writing room, not a dashboard.
// Navigation grows as the portal's sections ship (meetings, essays, chat,
// members, profile, admin); T01 links only what exists.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <p className={styles.wordmark}>
          <Link className={styles.wordmarkLink} href={routes.home}>
            JUNTO
          </Link>
        </p>
        <p className={styles.portalLabel}>Member Portal</p>
        <nav aria-label="Portal" className={styles.nav}>
          <ul className={styles.navList}>
            <li>
              <Link className={styles.navLink} href={routes.portal}>
                Home
              </Link>
            </li>
          </ul>
        </nav>
      </header>
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
