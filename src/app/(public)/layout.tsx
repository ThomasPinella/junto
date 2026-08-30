import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import styles from "./layout.module.css";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <SiteHeader contextLabel="Network archive" />
      <main className={styles.main} id="main-content">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
