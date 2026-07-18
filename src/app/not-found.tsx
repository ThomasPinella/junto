import Link from "next/link";

import { routes } from "@/config/routes";

import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.frame} id="main-content">
      <p className={styles.label}>404</p>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.body}>
        The page you asked for is not part of the record.{" "}
        <Link href={routes.home}>Return to the archive</Link>.
      </p>
    </main>
  );
}
