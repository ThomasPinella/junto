// The validated "next" destination travels from the sign-in request to the
// Auth callback in a short-lived, httpOnly cookie rather than in the emailed
// redirect URL: GoTrue's redirect allowlist stays exact, and the destination
// is re-validated at every read so a tampered cookie still cannot leave the
// application.
import "server-only";

export const NEXT_DESTINATION_COOKIE = "junto-auth-next";

export const NEXT_DESTINATION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60,
} as const;
