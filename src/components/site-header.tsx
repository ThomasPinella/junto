import Link from "next/link";

import { routes } from "@/config/routes";

import styles from "./site-header.module.css";

const navItems = [
  { label: "Archive", href: routes.essays },
  { label: "Meetings", href: routes.meetings },
  { label: "Authors", href: routes.authors },
  { label: "About", href: routes.about },
  { label: "Start a chapter", href: routes.startChapter },
  { label: "Member Portal", href: routes.portal },
] as const;

// Masthead posture per DESIGN.md ("Masthead and navigation"): the uppercase
// JUNTO wordmark with chapter or network context in restrained small caps and quiet
// publication navigation — the top of a publication, not an app toolbar.
export function SiteHeader({ contextLabel }: { contextLabel: string }) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.masthead}>
          <Link className={styles.wordmark} href={routes.home}>
            JUNTO
          </Link>
        </p>
        <p className={styles.chapter}>{contextLabel}</p>
      </div>
      <nav aria-label="Publication">
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
    </header>
  );
}
