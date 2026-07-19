import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/config/routes";
import { safeLocalPath } from "@/lib/auth/local-path";

import { PortalFrame } from "../frame";
import { requestSignInLink } from "./actions";

import content from "../content.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

// Safe, deliberately coarse messages: they may distinguish "invitation
// required", "check your email", "link invalid/expired", and ordinary
// sign-out, but never expose membership or invitation records
// (T03 boundaries; docs/membership/authentication-and-membership.md §3.1).
const STATUS_MESSAGES: Record<string, string> = {
  sent: "Check your email — a one-time sign-in link is on its way. It can be used once and expires after an hour.",
  "signed-out": "You have signed out.",
};

const ERROR_MESSAGES: Record<string, string> = {
  "invitation-required":
    "Junto membership is by invitation. This address does not match an open invitation — if you were expecting one, ask your chapter to check the address it invited.",
  "rate-limited": "Too many attempts for now. Wait a moment and try again.",
  "request-failed":
    "Something went wrong on our side and nothing was changed. Try again in a moment.",
  "email-invalid": "Enter the email address your invitation was sent to.",
  "link-invalid":
    "That sign-in link is not valid — it may already have been used. Request a fresh one below.",
  "link-expired": "That sign-in link has expired. Request a fresh one below.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = firstValue(params.status);
  const error = firstValue(params.error);
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  // Routing input only: anything unsafe is dropped here and re-validated
  // server-side before any redirect.
  const next = safeLocalPath(firstValue(params.next));

  return (
    <PortalFrame>
      <article>
        <p className={content.label}>Junto members only</p>
        <h1 className={content.title}>Sign in to your Junto</h1>
        <div className={content.body}>
          <p>
            Junto membership is by invitation from a chapter. Enter the email
            address your invitation was sent to, and we will email you a
            one-time sign-in link — no password needed.
          </p>
        </div>
        {statusMessage ? (
          <p className={content.notice} role="status">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className={content.problem} role="alert">
            {errorMessage}
          </p>
        ) : null}
        <form action={requestSignInLink} className={styles.form}>
          {next ? <input name="next" type="hidden" value={next} /> : null}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="email">
              Email address
            </label>
            <input
              autoComplete="email"
              className={styles.input}
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <button className={styles.submit} type="submit">
            Email me a sign-in link
          </button>
        </form>
        <p className={content.footnote}>
          Not a member? <Link href={routes.home}>The public archive</Link> is
          open to everyone.
        </p>
      </article>
    </PortalFrame>
  );
}
