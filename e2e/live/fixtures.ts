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

// The public demo anon key: used by the T04 journeys to prove RLS denials at
// the PostgREST layer with a real member session token (never the service
// role, and never any fabricated auth state).
export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

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
// T04: the public-archive chapter. Its slug is the live server's configured
// initial Junto, so `/meetings` serves its safe public meeting record. It
// deliberately has NO members or invitations.
export const JUNTO_P = {
  id: "c0700000-0000-4a00-8a00-000000000a04",
  slug: "t04-poplar",
  name: "T04 Poplar",
} as const;
// T04: flagged public but INACTIVE — its meetings must never be publicly
// visible, indistinguishable from a nonexistent chapter.
export const JUNTO_Q = {
  id: "c0700000-0000-4a00-8a00-000000000a05",
  slug: "t04-quince",
  name: "T04 Quince",
} as const;

// T05: the essay chapter — active with a PUBLIC archive so confirmed public
// essays are the only fixture content eligible for the safe public essay
// projection. Its members are the dedicated essay identities below; the T03
// private-Junto fixtures stay untouched.
export const JUNTO_E = {
  id: "c0700000-0000-4a00-8a00-000000000a06",
  slug: "t05-elm",
  name: "T05 Elm",
} as const;

export const MEMBER_EMAIL = "c07-t03-member@example.com";
export const UNINVITED_EMAIL = "c07-t03-uninvited@example.com";
// T05: real mailbox-authenticated essay identities, kept separate from the
// T03 member so the private-Junto entry assertions stay exactly as proven.
export const ESSAY_AUTHOR_EMAIL = "c10-t05-author@example.com";
export const ESSAY_COMEMBER_EMAIL = "c10-t05-comember@example.com";
// T05: a real NON-AUTHOR same-Junto admin, proving the publication
// transition's explicit-confirmation boundary is not weakened for admins.
export const ESSAY_ADMIN_EMAIL = "c11-t05-admin@example.com";
export const PUBLIC_AUTHOR_A_EMAIL = "c17-public-maya@example.com";
export const PUBLIC_AUTHOR_B_EMAIL = "c17-public-daniel@example.com";
export const INTEGRATED_MEMBER_EMAIL = "c22-t08-invitee@example.com";

const FIXTURE_JUNTOS = [
  JUNTO_A,
  JUNTO_B,
  JUNTO_C,
  JUNTO_P,
  JUNTO_Q,
  JUNTO_E,
] as const;
const FIXTURE_JUNTO_IDS = FIXTURE_JUNTOS.map((j) => j.id);
const FIXTURE_EMAILS = [
  MEMBER_EMAIL,
  UNINVITED_EMAIL,
  ESSAY_AUTHOR_EMAIL,
  ESSAY_COMEMBER_EMAIL,
  ESSAY_ADMIN_EMAIL,
  PUBLIC_AUTHOR_A_EMAIL,
  PUBLIC_AUTHOR_B_EMAIL,
  INTEGRATED_MEMBER_EMAIL,
] as const;

function isoDateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Marker strings that MUST NEVER appear in any public response. They are
// planted in the private columns of publicly listed meetings so a leak is
// directly observable.
export const PRIVATE_LOCATION_MARKER = "Fern Street carriage house";
export const PRIVATE_DEADLINE_MARKER_ISO = `${isoDateFromToday(18)}T18:00:00+00:00`;

export interface FixtureMeeting {
  id: string;
  juntoId: string;
  date: string;
  title: string | null;
  theme: string | null;
  description: string | null;
  location: string | null;
  essayDeadline: string | null;
  status: "upcoming" | "completed" | "cancelled" | "archived";
}

// Poplar's public history spans every lifecycle status; Cedar's and Quince's
// meetings exist only to prove they never surface publicly.
export const MEETING_P_UPCOMING: FixtureMeeting = {
  id: "c0700000-0000-4a00-8a00-00000000b001",
  juntoId: JUNTO_P.id,
  date: isoDateFromToday(21),
  title: "The century ahead",
  theme: "Continuity",
  description: "Essays on what the chapter owes its future readers.",
  location: PRIVATE_LOCATION_MARKER,
  essayDeadline: PRIVATE_DEADLINE_MARKER_ISO,
  status: "upcoming",
};
export const MEETING_P_COMPLETED: FixtureMeeting = {
  id: "c0700000-0000-4a00-8a00-00000000b002",
  juntoId: JUNTO_P.id,
  date: isoDateFromToday(-40),
  title: "On beginnings",
  theme: "Origins",
  description: "The essays read at the chapter's first public table.",
  location: PRIVATE_LOCATION_MARKER,
  essayDeadline: `${isoDateFromToday(-43)}T18:00:00+00:00`,
  status: "completed",
};
export const MEETING_P_CANCELLED: FixtureMeeting = {
  id: "c0700000-0000-4a00-8a00-00000000b003",
  juntoId: JUNTO_P.id,
  date: isoDateFromToday(7),
  title: "Postponed evening",
  theme: null,
  description: "Called off for the storm.",
  location: PRIVATE_LOCATION_MARKER,
  essayDeadline: null,
  status: "cancelled",
};
export const MEETING_P_ARCHIVED: FixtureMeeting = {
  id: "c0700000-0000-4a00-8a00-00000000b004",
  juntoId: JUNTO_P.id,
  date: isoDateFromToday(-100),
  title: "The founding table",
  theme: "Beginnings",
  description: "The founding record, archived but never deleted.",
  location: PRIVATE_LOCATION_MARKER,
  essayDeadline: null,
  status: "archived",
};
export const MEETING_C_PRIVATE: FixtureMeeting = {
  id: "c0700000-0000-4a00-8a00-00000000b005",
  juntoId: JUNTO_C.id,
  date: isoDateFromToday(-5),
  title: "Cedar private gathering",
  theme: null,
  description: "A private chapter's meeting.",
  location: PRIVATE_LOCATION_MARKER,
  essayDeadline: null,
  status: "completed",
};
export const MEETING_Q_INACTIVE: FixtureMeeting = {
  id: "c0700000-0000-4a00-8a00-00000000b006",
  juntoId: JUNTO_Q.id,
  date: isoDateFromToday(-30),
  title: "Quince farewell",
  theme: null,
  description: "The inactive chapter's final meeting.",
  location: PRIVATE_LOCATION_MARKER,
  essayDeadline: null,
  status: "completed",
};

// T05: the Elm meeting essays attach to. Its private columns carry the same
// planted markers, so an essay-projection leak of meeting context is
// directly observable.
export const MEETING_E_UPCOMING: FixtureMeeting = {
  id: "c0700000-0000-4a00-8a00-00000000b007",
  juntoId: JUNTO_E.id,
  date: isoDateFromToday(14),
  title: "What the essay owes its reader",
  theme: "Obligation",
  description: "The Elm chapter's next table.",
  location: PRIVATE_LOCATION_MARKER,
  essayDeadline: PRIVATE_DEADLINE_MARKER_ISO,
  status: "upcoming",
};

const FIXTURE_MEETINGS = [
  MEETING_P_UPCOMING,
  MEETING_P_COMPLETED,
  MEETING_P_CANCELLED,
  MEETING_P_ARCHIVED,
  MEETING_C_PRIVATE,
  MEETING_Q_INACTIVE,
  MEETING_E_UPCOMING,
] as const;

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

// PostgREST as a REAL authenticated member: the anon api key plus the
// member's own session access token — exactly what the application's RLS
// boundary faces. Used to prove denials at the API layer without any UI in
// between; it carries no service-role credentials.
export async function restAsUser(
  accessToken: string,
  path: string,
  {
    method = "GET",
    body,
    prefer,
  }: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<RestResult> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
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

// PostgREST as a REAL anonymous visitor: the anon api key alone, exactly
// what an unauthenticated internet reader presents. Used to prove what the
// safe public essay projection serves — and withholds — with no session at
// all.
export async function restAsAnon(
  path: string,
  { method = "GET" }: { method?: string } = {},
): Promise<RestResult> {
  const res = await guardedRequest("SUPABASE_URL", `${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
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

// Strict nested successful-response parsers. An HTTP 2xx listing whose
// elements are structurally broken must reject rather than filter to
// "absent"/"unrelated": cleanup and the independent absence verification
// share these helpers, so a lax parse could make both falsely agree that no
// fixture remains. Diagnostics name only the offending index/field — never
// raw body content, credentials, or headers.
const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface AdminUser {
  id: string;
  email: string;
}

function parseAdminUsers(json: unknown, context: string): AdminUser[] {
  const malformed = (detail: string) =>
    new Error(`${context}: malformed response body (${detail})`);
  if (!isRecord(json) || !Array.isArray(json.users)) {
    throw malformed('expected a "users" array');
  }
  return json.users.map((element, index) => {
    if (!isRecord(element)) {
      throw malformed(`users[${index}] is not an object`);
    }
    const { id, email } = element;
    if (typeof id !== "string" || !UUID_SHAPE.test(id)) {
      throw malformed(`users[${index}].id is not a UUID string`);
    }
    if (typeof email !== "string" || email.length === 0) {
      throw malformed(`users[${index}].email is not a nonempty string`);
    }
    return { id, email };
  });
}

interface MailpitRecipient {
  Address: string;
}

interface MailpitMessageSummary {
  ID: string;
  To: MailpitRecipient[];
}

function parseMailpitMessages(
  json: unknown,
  context: string,
): MailpitMessageSummary[] {
  const malformed = (detail: string) =>
    new Error(
      `Mailpit message listing (${context}): malformed response body (${detail})`,
    );
  if (!isRecord(json) || !Array.isArray(json.messages)) {
    throw malformed('expected a "messages" array');
  }
  return json.messages.map((element, index) => {
    if (!isRecord(element)) {
      throw malformed(`messages[${index}] is not an object`);
    }
    const { ID, To } = element;
    if (typeof ID !== "string" || ID.length === 0) {
      throw malformed(`messages[${index}].ID is not a nonempty string`);
    }
    if (!Array.isArray(To)) {
      throw malformed(`messages[${index}].To is not an array`);
    }
    const recipients = To.map((recipient, recipientIndex) => {
      if (
        !isRecord(recipient) ||
        typeof recipient.Address !== "string" ||
        recipient.Address.length === 0
      ) {
        throw malformed(
          `messages[${index}].To[${recipientIndex}].Address is not a ` +
            `nonempty string`,
        );
      }
      return { Address: recipient.Address };
    });
    return { ID, To: recipients };
  });
}

interface MailpitMessageDetail {
  Text: string;
  HTML: string;
}

function parseMailpitMessageDetail(json: unknown): MailpitMessageDetail {
  const malformed = (detail: string) =>
    new Error(`Mailpit message detail: malformed response body (${detail})`);
  if (!isRecord(json)) {
    throw malformed("expected an object");
  }
  const { Text, HTML } = json;
  if (typeof Text !== "string") {
    throw malformed('"Text" is not a string');
  }
  if (typeof HTML !== "string") {
    throw malformed('"HTML" is not a string');
  }
  return { Text, HTML };
}

export async function adminUsersByEmail(email: string): Promise<AdminUser[]> {
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
  // Fail closed: an HTTP 2xx whose body — outer shape or any nested
  // element — is malformed must not read as "no users" either.
  return parseAdminUsers(json, `admin user listing for ${email}`).filter(
    (u) => u.email === email,
  );
}

async function mailpitMessages(
  context: string,
): Promise<MailpitMessageSummary[]> {
  // An HTTP 2xx whose body — outer `messages` array or any nested
  // message/recipient — is malformed fails closed rather than reading as
  // "no messages" or "unrelated mail".
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
  return parseMailpitMessages(json, context);
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
    const match = messages.find((m) => m.To.some((t) => t.Address === email));
    if (match) {
      const msgRes = await guardedRequest(
        "MAILPIT_URL",
        `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(match.ID)}`,
      );
      if (!msgRes.ok) {
        throw new Error(`Mailpit message detail: HTTP ${msgRes.status}`);
      }
      let detailJson: unknown = null;
      try {
        detailJson = await msgRes.json();
      } catch {
        detailJson = null;
      }
      // A malformed detail 200 rejects here; it must never degrade into
      // "no link arrived" polling behavior.
      const msg = parseMailpitMessageDetail(detailJson);
      const href = msg.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
      if (href?.[1]) return href[1].replaceAll("&amp;", "&");
      const plain = msg.Text.match(
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
    body: [
      // Portal fixtures stay off the public archive surface entirely.
      ...[JUNTO_A, JUNTO_B, JUNTO_C].map((junto) => ({
        id: junto.id,
        name: junto.name,
        slug: junto.slug,
        status: "active",
        archive_visibility: "private",
      })),
      // The public-archive chapter (memberless) and the inactive trap.
      {
        id: JUNTO_P.id,
        name: JUNTO_P.name,
        slug: JUNTO_P.slug,
        status: "active",
        archive_visibility: "public",
      },
      {
        id: JUNTO_Q.id,
        name: JUNTO_Q.name,
        slug: JUNTO_Q.slug,
        status: "inactive",
        archive_visibility: "public",
      },
      // T05: the essay chapter with a public archive.
      {
        id: JUNTO_E.id,
        name: JUNTO_E.name,
        slug: JUNTO_E.slug,
        status: "active",
        archive_visibility: "public",
      },
    ],
  });
  if (juntos.status >= 300) {
    throw new Error(`Failed to seed juntos: ${juntos.status} ${juntos.text}`);
  }
  const meetings = await restFetch("/rest/v1/meetings", {
    method: "POST",
    prefer: "return=minimal",
    body: FIXTURE_MEETINGS.map((meeting) => ({
      id: meeting.id,
      junto_id: meeting.juntoId,
      meeting_date: meeting.date,
      title: meeting.title,
      theme: meeting.theme,
      description: meeting.description,
      location: meeting.location,
      essay_deadline: meeting.essayDeadline,
      status: meeting.status,
    })),
  });
  if (meetings.status >= 300) {
    throw new Error(
      `Failed to seed meetings: ${meetings.status} ${meetings.text}`,
    );
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
      // T05: the essay author and co-member enter Elm as ordinary members.
      {
        junto_id: JUNTO_E.id,
        email_normalized: ESSAY_AUTHOR_EMAIL,
        role: "member",
        status: "pending",
      },
      {
        junto_id: JUNTO_P.id,
        email_normalized: PUBLIC_AUTHOR_A_EMAIL,
        // T08 uses this existing public-author identity as Poplar's admin so
        // the complete loop can begin with a real UI-created invitation.
        role: "admin",
        status: "pending",
      },
      {
        junto_id: JUNTO_P.id,
        email_normalized: PUBLIC_AUTHOR_B_EMAIL,
        role: "member",
        status: "pending",
      },
      {
        junto_id: JUNTO_E.id,
        email_normalized: ESSAY_COMEMBER_EMAIL,
        role: "member",
        status: "pending",
      },
      // C11: the non-author Elm admin for the transition-confirmation
      // journeys.
      {
        junto_id: JUNTO_E.id,
        email_normalized: ESSAY_ADMIN_EMAIL,
        role: "admin",
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

  // Essays first: they reference meetings, juntos, and auth users (authors
  // have no cascade), and this also removes essays the journeys created
  // (matched by junto).
  await attempt("delete essays", () =>
    checkedDelete(`/rest/v1/essays?junto_id=${idFilter}`),
  );
  // Meetings next: they reference the fixture juntos, and this also removes
  // meetings the journeys created through the UI (matched by junto).
  await attempt("delete meetings", () =>
    checkedDelete(`/rest/v1/meetings?junto_id=${idFilter}`),
  );
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
    expectEmptyRest("essays", `/rest/v1/essays?junto_id=${idFilter}&select=id`),
  );
  await check(() =>
    expectEmptyRest(
      "meetings",
      `/rest/v1/meetings?junto_id=${idFilter}&select=id`,
    ),
  );
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
      m.To.some((t) =>
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
