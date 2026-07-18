import type { Metadata } from "next";

import styles from "../publication.module.css";

export const metadata: Metadata = {
  title: "Authors",
};

export default function AuthorsPage() {
  return (
    <article>
      <h1>Authors</h1>
      <p className={styles.lede}>
        Every Junto essay is signed. Authors collect their published essays
        under their own name.
      </p>
      <hr className={styles.rule} />
      <p className={styles.empty}>
        Author pages appear as members publish their first essays.
      </p>
    </article>
  );
}
