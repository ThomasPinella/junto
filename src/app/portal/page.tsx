import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Member portal",
};

export default function PortalHomePage() {
  return (
    <article>
      <p className={styles.label}>Junto members only</p>
      <h1 className={styles.title}>The writing room</h1>
      <div className={styles.body}>
        <p>
          The member portal is the chapter&rsquo;s private side of Junto: the
          next meeting, essay deadlines, drafts in progress, and discussion
          among members.
        </p>
        <p>
          Member sign-in is not yet open. Junto membership is by invitation from
          a chapter, and nothing private is stored or shown here yet.
        </p>
        <p>
          In the meantime,{" "}
          <Link href={routes.home}>read the public archive</Link>.
        </p>
      </div>
    </article>
  );
}
