import Link from "next/link";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";

import styles from "./frame.module.css";

// Shared shell for portal surfaces outside a selected Junto (sign-in, entry
// selection, empty portal): the JUNTO identity with explicit members-only
// language, and a quiet single-column writing-room posture — never a
// dashboard (docs/design/surface-guidelines.md §7).
export function PortalFrame({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
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
        {aside}
      </header>
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
