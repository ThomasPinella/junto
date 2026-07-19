// Safe auth error classification (docs/membership §3.1, T03 boundaries):
// messages may distinguish "invitation required", "check your email", and
// "link invalid/expired", but must never expose membership or invitation
// records. Only coarse, already-safe signals (HTTP status, GoTrue error
// codes) are consulted; raw provider messages are never shown to users.

export type SignInErrorKey =
  "invitation-required" | "rate-limited" | "request-failed";

// The before_user_created hook rejects uninvited addresses with a 403; that
// rejection is product behavior and is allowed to be named. Everything else
// collapses into generic failures.
export function signInErrorKey(
  error: { status?: number } | null | undefined,
): SignInErrorKey | null {
  if (!error) {
    return null;
  }
  if (error.status === 403) {
    return "invitation-required";
  }
  if (error.status === 429) {
    return "rate-limited";
  }
  return "request-failed";
}

export type CallbackErrorKey = "link-expired" | "link-invalid";

// GoTrue reports verification failures to the redirect target via
// error/error_code query parameters; only expiry is worth distinguishing.
export function callbackErrorKey(params: URLSearchParams): CallbackErrorKey {
  return params.get("error_code") === "otp_expired"
    ? "link-expired"
    : "link-invalid";
}
