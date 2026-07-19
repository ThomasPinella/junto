// Loopback-only guarded transport for the live T03 fixture harness.
//
// The harness mutates fixtures with service-role privileges, so it follows
// the same fail-closed principles as the T02 Auth regression harness
// (supabase/tests/auth/verify-mailbox-ownership.mjs): every request is
// revalidated against a strict loopback policy at the lowest request layer
// immediately before fetch, redirects are always refused, and there is no
// remote override. Unit coverage lives in tests/unit/live-loopback.test.ts.

// WHATWG URL parsing normalizes hostnames first (lowercase, hex/short IPv4
// forms to dotted-quad, IPv6 to canonical bracketed form), so these checks
// run against canonical hosts. Only literal loopback forms are accepted;
// arbitrary DNS names that might resolve locally are not.
const IPV4_LOOPBACK = /^127(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function assertLoopbackTarget(name: string, value: string): void {
  // Deliberately never echoes the raw value or any credential material.
  const refusal = (detail: string) =>
    new Error(
      `${name} ${detail}. This harness performs service-role fixture ` +
        `mutations and only runs against the local loopback Supabase stack ` +
        `(allowed hosts: localhost, 127.0.0.0/8, [::1]); every non-loopback ` +
        `target is refused and there is no remote override.`,
    );
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    throw refusal("is not a parseable URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw refusal(`uses the unsupported scheme "${url.protocol}"`);
  }
  const host = url.hostname;
  if (host !== "localhost" && host !== "[::1]" && !IPV4_LOOPBACK.test(host)) {
    throw refusal(`host "${host}" is not a loopback address`);
  }
}

export interface GuardedRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// The single lowest-level transport: every fixture-harness network request
// goes through here and nothing else calls global fetch. The actual composed
// request URL is revalidated immediately before the request, and redirects
// are always refused so an accepted loopback responder can never forward a
// privileged request (service-role apikey header, DELETE, JSON bodies) to a
// remote origin. Callers cannot override the redirect policy.
export async function guardedRequest(
  targetName: string,
  url: string,
  { method = "GET", headers, body }: GuardedRequestInit = {},
): Promise<Response> {
  assertLoopbackTarget(targetName, url);
  return fetch(url, { method, headers, body, redirect: "error" });
}
