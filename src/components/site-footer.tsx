import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p className={styles.line}>
        JUNTO · A civic journal written around a table
      </p>
    </footer>
  );
}
