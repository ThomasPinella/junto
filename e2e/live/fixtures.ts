// Deterministic fixtures for the live T03 member-entry journeys.
//
// Privileged (service-role) setup and teardown run ONLY against explicit
// loopback endpoints through the guarded transport in loopback.ts, reusing
// the proven T02 principles: strict successful-response schemas (an HTTP 2xx
// with a malformed body never reads as "no rows"/"no users"/"no messages"),
// checked cleanup of every fixture class and identity independently,
// fixture-absence verification that runs even when cleanup fails, and
// credential-free diagnostics.

import { guardedRequest } from "./loopback";

export const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

// Well-known local Supabase demo keys (derived from the default local JWT
// secret). These are NOT secrets: they ship with the Supabase CLI and are
// identical on every default local stack. Env-overridable keys are usable
// only against the hard-loopback targets enforced by the guarded transport.
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Fixed, test-scoped identifiers so setup and teardown are unambiguous.
// Distinct from the T02 harness fixtures (c0300000-…).
export const JUNTO_A = {
  id: "c0700000-0000-4a00-8a00-000000000a01",
  slug: "t03-alder",
  name: "T03 Alder",
} as const;
export const JUNTO_B = {
  id: "c0700000-0000-4a00-8a00-000000000a02",
  slug: "t03-birch",
  name: "T03 Birch",
} as const;
// No fixture user ever holds a membership here; its name must never appear
// in any portal response served to the fixture member.
export const JUNTO_C = {
  id: "c0700000-0000-4a00-8a00-000000000a03",
  slug: "t03-cedar",
  name: "T03 Cedar",
} as const;

export const MEMBER_EMAIL = "c07-t03-member@example.com";
export const UNINVITED_EMAIL = "c07-t03-uninvited@example.com";

const FIXTURE_JUNTOS = [JUNTO_A, JUNTO_B, JUNTO_C] as const;
const FIXTURE_JUNTO_IDS = FIXTURE_JUNTOS.map((j) => j.id);
const FIXTURE_EMAILS = [MEMBER_EMAIL, UNINVITED_EMAIL] as const;

interface RestResult {
  status: number;
  json: unknown;
  text: string;
}

async function restFetch(
  path: string,
  {
    method = "GET",
    body,
    prefer,
  }: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<RestResult> {
  // service_role bypasses RLS; used only for fixture setup/teardown and
  // state assertions, never by the application under test.
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await guardedRequest("SUPABASE_URL", `${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

export async function adminUsersByEmail(
  email: string,
): Promise<Array<{ id: string; email?: string }>> {
  // The admin filter is a partial match; narrow to exact email in code.
  const res = await guardedRequest(
    "SUPABASE_URL",
    `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (res.status >= 300) {
    // Fail closed: a failed listing must not read as "no users".
    throw new Error(`admin user listing for ${email}: HTTP ${res.status}`);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const users =
    json && typeof json === "object" && "users" in json
      ? (json as { users: unknown }).users
      : null;
  if (!Array.isArray(users)) {
    // Fail closed: an HTTP 2xx with a missing/null/non-array `users` value
    // must not read as "no users" either.
    throw new Error(
      `admin user listing for ${email}: malformed response body ` +
        `(expected a "users" array)`,
    );
  }
  return (users as Array<{ id: string; email?: string }>).filter(
    (u) => u.email === email,
  );
}

async function mailpitMessages(
  context: string,
): Promise<Array<{ ID: string; To?: Array<{ Address: string }> }>> {
  // An HTTP 2xx without an exact `messages` array fails closed rather than
  // reading as "no messages".
  const res = await guardedRequest(
    "MAILPIT_URL",
    `${MAILPIT_URL}/api/v1/messages`,
  );
  if (!res.ok) {
    throw new Error(`Mailpit message listing (${context}): HTTP ${res.status}`);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const messages =
    json && typeof json === "object" && "messages" in json
      ? (json as { messages: unknown }).messages
      : null;
  if (!Array.isArray(messages)) {
    throw new Error(
      `Mailpit message listing (${context}): malformed response body ` +
        `(expected a "messages" array)`,
    );
  }
  return messages as Array<{ ID: string; To?: Array<{ Address: string }> }>;
}

export async function clearMailbox(): Promise<void> {
  const res = await guardedRequest(
    "MAILPIT_URL",
    `${MAILPIT_URL}/api/v1/messages`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Mailpit message clear: HTTP ${res.status}`);
  }
}

// Extracts the actual emailed Supabase Auth verification link for `email`
// from the running Mailpit instance, exactly as a member would click it.
export async function latestAuthLinkFor(
  email: string,
  {
    attempts = 40,
    delayMs = 250,
  }: { attempts?: number; delayMs?: number } = {},
): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    const messages = await mailpitMessages("verification-email polling");
    const match = messages.find((m) =>
      (m.To ?? []).some((t) => t.Address === email),
    );
    if (match) {
      const msgRes = await guardedRequest(
        "MAILPIT_URL",
        `${MAILPIT_URL}/api/v1/message/${match.ID}`,
      );
      if (!msgRes.ok) {
        throw new Error(`Mailpit message detail: HTTP ${msgRes.status}`);
      }
      const msg = (await msgRes.json()) as { Text?: string; HTML?: string };
      const href = (msg.HTML ?? "").match(
        /href="([^"]*\/auth\/v1\/verify[^"]*)"/,
      );
      if (href?.[1]) return href[1].replaceAll("&amp;", "&");
      const plain = (msg.Text ?? "").match(
        /https?:\/\/[^\s<>"')]+\/auth\/v1\/verify[^\s<>"')]*/,
      );
      if (plain?.[0]) return plain[0];
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`No verification email with a link arrived for ${email}`);
}

async function seed(): Promise<void> {
  const juntos = await restFetch("/rest/v1/juntos", {
    method: "POST",
    prefer: "return=minimal",
    body: FIXTURE_JUNTOS.map((junto) => ({
      id: junto.id,
      name: junto.name,
      slug: junto.slug,
      status: "active",
      // Portal fixtures stay off the public archive surface entirely.
      archive_visibility: "private",
    })),
  });
  if (juntos.status >= 300) {
    throw new Error(`Failed to seed juntos: ${juntos.status} ${juntos.text}`);
  }
  const invites = await restFetch("/rest/v1/junto_invitations", {
    method: "POST",
    prefer: "return=minimal",
    body: [
      {
        junto_id: JUNTO_A.id,
        email_normalized: MEMBER_EMAIL,
        role: "admin",
        status: "pending",
      },
      {
        junto_id: JUNTO_B.id,
        email_normalized: MEMBER_EMAIL,
        role: "member",
        status: "pending",
      },
    ],
  });
  if (invites.status >= 300) {
    throw new Error(
      `Failed to seed invitations: ${invites.status} ${invites.text}`,
    );
  }
}

export async function cleanupFixtures(): Promise<void> {
  // FK-safe order: memberships and invitations reference both the junto and
  // auth.users (claimed_by/user_id have no cascade), so remove them before
  // the users and the juntos. Deleting the auth user cascades its profile.
  //
  // Every fixture class AND every fixture identity is attempted
  // independently with its response checked: one listing or deletion failure
  // never prevents the remaining attempts, and all failures are aggregated
  // into one thrown error so a run cannot succeed while fixtures survive.
  const errors: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : err}`);
    }
  };
  const checkedDelete = async (path: string) => {
    const res = await restFetch(path, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    if (res.status >= 300) {
      throw new Error(`HTTP ${res.status}`);
    }
  };
  const idFilter = `in.(${FIXTURE_JUNTO_IDS.join(",")})`;

  await attempt("delete junto_members", () =>
    checkedDelete(`/rest/v1/junto_members?junto_id=${idFilter}`),
  );
  await attempt("delete junto_invitations", () =>
    checkedDelete(`/rest/v1/junto_invitations?junto_id=${idFilter}`),
  );
  for (const email of FIXTURE_EMAILS) {
    await attempt(`delete auth user(s) for ${email}`, async () => {
      const userErrors: string[] = [];
      for (const user of await adminUsersByEmail(email)) {
        // Each already-enumerated user is the smallest fixture unit: a
        // thrown request for one user must not skip the remaining users.
        try {
          const res = await guardedRequest(
            "SUPABASE_URL",
            `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
            {
              method: "DELETE",
              headers: {
                apikey: SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              },
            },
          );
          if (res.status >= 300) {
            userErrors.push(`HTTP ${res.status} deleting user ${user.id}`);
          }
        } catch (err) {
          userErrors.push(
            `deleting user ${user.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      if (userErrors.length > 0) {
        throw new Error(userErrors.join("; "));
      }
    });
  }
  await attempt("delete juntos", () =>
    checkedDelete(`/rest/v1/juntos?id=${idFilter}`),
  );
  await attempt("clear Mailpit messages", () => clearMailbox());

  if (errors.length > 0) {
    throw new Error(`cleanup failed — ${errors.join("; ")}`);
  }
}

export async function verifyFixturesAbsent(): Promise<void> {
  // Cleanup responses are checked above; this independently proves the
  // fixtures are actually gone so teardown cannot silently fail open. Every
  // check runs even when an earlier one fails; query failures and residues
  // are aggregated together.
  const problems: string[] = [];
  const residues: string[] = [];
  const check = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
    }
  };
  const idFilter = `in.(${FIXTURE_JUNTO_IDS.join(",")})`;
  const expectEmptyRest = async (label: string, path: string) => {
    const res = await restFetch(path);
    if (res.status >= 300 || !Array.isArray(res.json)) {
      // A 2xx with a non-array body must not read as "empty".
      throw new Error(
        `verification query for ${label} failed (HTTP ${res.status}, ` +
          `array body required)`,
      );
    }
    if (res.json.length > 0) {
      residues.push(`${label} (${res.json.length} row(s))`);
    }
  };
  await check(() =>
    expectEmptyRest(
      "junto_members",
      `/rest/v1/junto_members?junto_id=${idFilter}&select=user_id`,
    ),
  );
  await check(() =>
    expectEmptyRest(
      "junto_invitations",
      `/rest/v1/junto_invitations?junto_id=${idFilter}&select=id`,
    ),
  );
  await check(() =>
    expectEmptyRest("juntos", `/rest/v1/juntos?id=${idFilter}&select=id`),
  );
  for (const email of FIXTURE_EMAILS) {
    await check(async () => {
      if ((await adminUsersByEmail(email)).length > 0) {
        residues.push(`auth user ${email}`);
      }
    });
  }
  await check(async () => {
    const messages = await mailpitMessages("fixture-absence verification");
    const lingering = messages.filter((m) =>
      (m.To ?? []).some((t) =>
        (FIXTURE_EMAILS as readonly string[]).includes(t.Address),
      ),
    );
    if (lingering.length > 0) {
      residues.push(`${lingering.length} Mailpit message(s) to fixture emails`);
    }
  });
  if (residues.length > 0) {
    problems.push(`fixtures remain after cleanup: ${residues.join(", ")}`);
  }
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
}

export async function resetFixtures(): Promise<void> {
  // Stale fixtures from an aborted earlier run are removed (checked) before
  // seeding; a preparation failure aborts the run and nothing new is ever
  // seeded on top of an unverified state.
  try {
    await cleanupFixtures();
  } catch (err) {
    throw new Error(
      `stale-fixture preparation failed; refusing to seed new fixtures — ${
        err instanceof Error ? err.message : err
      }`,
    );
  }
  await seed();
}

export async function claimedInvitationCount(): Promise<number> {
  const res = await restFetch(
    `/rest/v1/junto_invitations?junto_id=in.(${FIXTURE_JUNTO_IDS.join(",")})` +
      `&status=eq.claimed&select=id,claimed_by,claimed_at`,
  );
  if (res.status >= 300 || !Array.isArray(res.json)) {
    throw new Error(`claimed-invitation query failed (HTTP ${res.status})`);
  }
  const rows = res.json as Array<{
    claimed_by?: unknown;
    claimed_at?: unknown;
  }>;
  if (rows.some((row) => !row.claimed_by || !row.claimed_at)) {
    throw new Error("claimed invitation rows are missing claim evidence");
  }
  return rows.length;
}

export async function membershipCountForFixtureJuntos(): Promise<number> {
  const res = await restFetch(
    `/rest/v1/junto_members?junto_id=in.(${FIXTURE_JUNTO_IDS.join(",")})&select=id`,
  );
  if (res.status >= 300 || !Array.isArray(res.json)) {
    throw new Error(`membership query failed (HTTP ${res.status})`);
  }
  return res.json.length;
}

// Deactivates the fixture member's membership in `juntoId` directly through
// the privileged loopback API, simulating an admin acting elsewhere while
// the member's Auth session stays valid.
export async function deactivateMembership(
  juntoId: string,
  email: string,
): Promise<void> {
  const users = await adminUsersByEmail(email);
  const user = users[0];
  if (!user) {
    throw new Error(`no auth user found for ${email} to deactivate`);
  }
  const res = await restFetch(
    `/rest/v1/junto_members?junto_id=eq.${juntoId}&user_id=eq.${user.id}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { status: "inactive" },
    },
  );
  if (res.status >= 300 || !Array.isArray(res.json) || res.json.length !== 1) {
    throw new Error(
      `membership deactivation did not update exactly one row (HTTP ${res.status})`,
    );
  }
}
