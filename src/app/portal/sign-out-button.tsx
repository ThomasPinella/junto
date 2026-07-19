import { signOut } from "./actions";

import styles from "./frame.module.css";

// Progressive-enhancement sign-out: a plain form posting to a server
// action, so it works without client JavaScript.
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className={styles.signOut} type="submit">
        Sign out
      </button>
    </form>
  );
}
