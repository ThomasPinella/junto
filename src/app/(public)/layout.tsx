import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";

import styles from "./layout.module.css";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const site = siteConfig();
  return (
    <div className={styles.frame}>
      <SiteHeader chapterName={site.initialChapterName} />
      <main className={styles.main} id="main-content">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
