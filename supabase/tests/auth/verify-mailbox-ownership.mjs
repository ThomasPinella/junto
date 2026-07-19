#!/usr/bin/env node
// Live GoTrue regression: mailbox ownership must gate invitation claiming.
//
// This test talks to the REAL local Supabase Auth API (GoTrue) and Mailpit,
// not to auth.users directly, because the vulnerability it guards against
// lives in Auth *configuration* semantics that pgTAP cannot observe: with
// `[auth.email] enable_confirmations = false`, GoTrue implicitly confirms
// password signups and issues a session immediately, letting anyone who knows
// an invited address claim its membership/admin role without controlling the
// mailbox (docs/membership/authentication-and-membership.md §3.1).
//
// It proves, end to end against the running stack:
//   1. uninvited password signup and uninvited OTP are rejected 403 with no
//      auth user created (before_user_created hook);
//   2. password signup for a pending *admin* invitation yields NO usable
//      session before verification, leaves email_confirmed_at unset, and
//      cannot obtain a membership;
//   3. after completing the real emailed magic-link/OTP confirmation flow, the
//      matching verified identity claims its membership successfully.
//
// Safety properties (guarded by harness-safety.test.mjs):
//   - The harness mutates fixtures with service-role privileges, so before
//     the FIRST network request both target URLs must be explicit loopback
//     hosts (localhost, 127.0.0.0/8, [::1]). Every non-loopback target is
//     refused with no override; env-supplied remote URLs and keys can never
//     cause even a health-check request.
//   - Teardown runs from `finally`, checks every cleanup response, verifies
//     the fixtures are actually gone, and a teardown failure exits nonzero
//     even when all functional checks passed. A functional failure is still
//     reported alongside a teardown failure.
//   - Importing this module has no side effects; the run starts only when
//     the file is executed directly.

import { pathToFileURL } from "node:url";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

// Well-known local Supabase demo keys (derived from the default local JWT
// secret). These are NOT secrets: they ship with the Supabase CLI and are
// identical on every default local stack. Env-overridable keys are usable
// only against the hard-loopback targets enforced below.
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Fixed, test-scoped identifiers so setup and teardown are unambiguous.
const JUNTO_ID = "c0300000-0000-4a00-8a00-000000000001";
const JUNTO_SLUG = "c03-auth-regression";
const INVITED_ADMIN = "c03-invited-admin@example.com";
const INVITED_MEMBER = "c03-invited-member@example.com";
const UNINVITED = "c03-uninvited@example.com";
const PASSWORD = "c03-regression-not-a-real-secret";
const TEST_EMAILS = [INVITED_ADMIN, INVITED_MEMBER, UNINVITED];

// WHATWG URL parsing normalizes hostnames first (lowercase, hex/short IPv4
// forms to dotted-quad, IPv6 to canonical bracketed form), so these checks
// run against canonical hosts. Only literal loopback forms are accepted;
// arbitrary DNS names that might resolve locally are not.
const IPV4_LOOPBACK = /^127(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function assertLoopbackTarget(name, value) {
  // Deliberately never echoes the raw value or any credential material.
  const refusal = (detail) =>
    new Error(
      `${name} ${detail}. This harness performs service-role fixture ` +
        `mutations and only runs against the local loopback Supabase stack ` +
        `(allowed hosts: localhost, 127.0.0.0/8, [::1]); every non-loopback ` +
        `target is refused and there is no remote override.`,
    );
  let url;
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

let failures = 0;
let checks = 0;
function ok(cond, label) {
  checks += 1;
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`);
  }
}

async function authFetch(
  path,
  { method = "GET", token = ANON_KEY, body } = {},
) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function restFetch(path, { method = "GET", body, prefer } = {}) {
  // service_role bypasses RLS; used only for fixture setup/teardown.
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function adminUsersByEmail(email) {
  // The admin filter is a partial match; narrow to exact email in code.
  const res = await authFetch(
    `/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { token: SERVICE_ROLE_KEY },
  );
  if (res.status >= 300) {
    // Fail closed: a failed listing must not read as "no users".
    throw new Error(`admin user listing for ${email}: HTTP ${res.status}`);
  }
  const users = res.json?.users ?? [];
  return users.filter((u) => u.email === email);
}

async function mailpitClear() {
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Mailpit message clear: HTTP ${res.status}`);
  }
}

async function mailpitLatestTokenFor(
  email,
  { attempts = 40, delayMs = 250 } = {},
) {
  for (let i = 0; i < attempts; i += 1) {
    const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const list = await listRes.json();
    const match = (list.messages ?? []).find((m) =>
      (m.To ?? []).some((t) => t.Address === email),
    );
    if (match) {
      const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`);
      const msg = await msgRes.json();
      const body = `${msg.Text ?? ""}\n${msg.HTML ?? ""}`;
      const m = body.match(/[?&]token=([a-zA-Z0-9]+)&type=([a-zA-Z0-9_]+)/);
      if (m) return { token: m[1], type: m[2] };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`No verification email with a token arrived for ${email}`);
}

export async function cleanup() {
  // FK-safe order: memberships and invitations reference both the junto and
  // auth.users (claimed_by/user_id have no cascade), so remove them before the
  // users and the junto. Deleting the auth user cascades its profile.
  //
  // Every step is attempted and every response checked; any failure makes
  // cleanup throw so the run cannot succeed while fixtures survive.
  const errors = [];
  const attempt = async (label, fn) => {
    try {
      await fn();
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
    }
  };
  const checkedDelete = async (label, path) => {
    const res = await restFetch(path, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    if (res.status >= 300) {
      throw new Error(`HTTP ${res.status}`);
    }
  };

  await attempt("delete junto_members", () =>
    checkedDelete(
      "junto_members",
      `/rest/v1/junto_members?junto_id=eq.${JUNTO_ID}`,
    ),
  );
  await attempt("delete junto_invitations", () =>
    checkedDelete(
      "junto_invitations",
      `/rest/v1/junto_invitations?junto_id=eq.${JUNTO_ID}`,
    ),
  );
  await attempt("delete fixture auth users", async () => {
    for (const email of TEST_EMAILS) {
      for (const user of await adminUsersByEmail(email)) {
        const res = await authFetch(`/auth/v1/admin/users/${user.id}`, {
          method: "DELETE",
          token: SERVICE_ROLE_KEY,
        });
        if (res.status >= 300) {
          throw new Error(`HTTP ${res.status} deleting user for ${email}`);
        }
      }
    }
  });
  await attempt("delete junto", () =>
    checkedDelete("juntos", `/rest/v1/juntos?id=eq.${JUNTO_ID}`),
  );
  await attempt("clear Mailpit messages", () => mailpitClear());

  if (errors.length > 0) {
    throw new Error(`cleanup failed — ${errors.join("; ")}`);
  }
}

export async function verifyFixturesAbsent() {
  // Cleanup responses are checked above; this independently proves the
  // fixtures are actually gone so teardown cannot silently fail open.
  const residues = [];
  const expectEmptyRest = async (label, path) => {
    const res = await restFetch(path);
    if (res.status >= 300 || !Array.isArray(res.json)) {
      throw new Error(`teardown verification query for ${label} failed`);
    }
    if (res.json.length > 0) {
      residues.push(`${label} (${res.json.length} row(s))`);
    }
  };
  await expectEmptyRest(
    "junto_members",
    `/rest/v1/junto_members?junto_id=eq.${JUNTO_ID}&select=user_id`,
  );
  await expectEmptyRest(
    "junto_invitations",
    `/rest/v1/junto_invitations?junto_id=eq.${JUNTO_ID}&select=id`,
  );
  await expectEmptyRest(
    "juntos",
    `/rest/v1/juntos?id=eq.${JUNTO_ID}&select=id`,
  );
  for (const email of TEST_EMAILS) {
    if ((await adminUsersByEmail(email)).length > 0) {
      residues.push(`auth user ${email}`);
    }
  }
  const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
  if (!res.ok) {
    throw new Error(
      `teardown verification Mailpit listing: HTTP ${res.status}`,
    );
  }
  const list = await res.json();
  const lingering = (list.messages ?? []).filter((m) =>
    (m.To ?? []).some((t) => TEST_EMAILS.includes(t.Address)),
  );
  if (lingering.length > 0) {
    residues.push(`${lingering.length} Mailpit message(s) to fixture emails`);
  }
  if (residues.length > 0) {
    throw new Error(`fixtures remain after cleanup: ${residues.join(", ")}`);
  }
}

async function seed() {
  const junto = await restFetch("/rest/v1/juntos", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: JUNTO_ID,
      name: "C03 Auth Regression",
      slug: JUNTO_SLUG,
      status: "active",
      archive_visibility: "public",
    },
  });
  if (junto.status >= 300) {
    throw new Error(`Failed to seed junto: ${junto.status} ${junto.text}`);
  }
  const invites = await restFetch("/rest/v1/junto_invitations", {
    method: "POST",
    prefer: "return=minimal",
    body: [
      {
        junto_id: JUNTO_ID,
        email_normalized: INVITED_ADMIN,
        role: "admin",
        status: "pending",
      },
      {
        junto_id: JUNTO_ID,
        email_normalized: INVITED_MEMBER,
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

async function runChecks() {
  // 1. Uninvited signup/OTP remain rejected with no auth user.
  console.log("Uninvited signup and OTP are rejected with no auth user:");
  const uninvitedSignup = await authFetch("/auth/v1/signup", {
    method: "POST",
    body: { email: UNINVITED, password: PASSWORD },
  });
  ok(uninvitedSignup.status === 403, "uninvited password signup returns 403");
  ok(
    /invitation only/i.test(uninvitedSignup.json?.msg ?? ""),
    "uninvited signup message states invitation-only",
  );
  ok(
    (await adminUsersByEmail(UNINVITED)).length === 0,
    "uninvited signup created no auth user",
  );

  const uninvitedOtp = await authFetch("/auth/v1/otp", {
    method: "POST",
    body: { email: UNINVITED, create_user: true },
  });
  ok(uninvitedOtp.status === 403, "uninvited OTP returns 403");
  ok(
    (await adminUsersByEmail(UNINVITED)).length === 0,
    "uninvited OTP created no auth user",
  );

  // 2. Password signup for the invited ADMIN yields no usable session and no
  //    membership before mailbox verification.
  console.log(
    "\nPassword signup for an invited admin cannot claim before verification:",
  );
  await mailpitClear();
  const adminSignup = await authFetch("/auth/v1/signup", {
    method: "POST",
    body: { email: INVITED_ADMIN, password: PASSWORD },
  });
  ok(adminSignup.status === 200, "invited-admin signup is admitted (200)");
  ok(
    !adminSignup.json?.access_token,
    "invited-admin signup returns NO session (no access_token)",
  );
  ok(
    !adminSignup.json?.email_confirmed_at &&
      !adminSignup.json?.user?.email_confirmed_at,
    "invited-admin signup response has email_confirmed_at unset",
  );

  const adminUsers = await adminUsersByEmail(INVITED_ADMIN);
  ok(adminUsers.length === 1, "invited-admin auth user exists (unconfirmed)");
  ok(
    adminUsers[0] && adminUsers[0].email_confirmed_at == null,
    "invited-admin auth user has email_confirmed_at unset",
  );

  // The attacker has no session; the only credential path (password grant)
  // must be refused because the email is unconfirmed, so no claim is possible.
  const passwordGrant = await authFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email: INVITED_ADMIN, password: PASSWORD },
  });
  ok(
    passwordGrant.status === 400 &&
      passwordGrant.json?.error_code === "email_not_confirmed",
    "password sign-in for unverified invited-admin is refused (email_not_confirmed)",
  );
  ok(
    !passwordGrant.json?.access_token,
    "unverified invited-admin obtains no usable session token",
  );

  const membersAfterAdminSignup = await restFetch(
    `/rest/v1/junto_members?junto_id=eq.${JUNTO_ID}&select=user_id,role,status`,
  );
  const adminUserId = adminUsers[0]?.id;
  ok(
    Array.isArray(membersAfterAdminSignup.json) &&
      !membersAfterAdminSignup.json.some((m) => m.user_id === adminUserId),
    "unverified invited-admin obtained no membership",
  );
  ok(
    Array.isArray(membersAfterAdminSignup.json) &&
      !membersAfterAdminSignup.json.some((m) => m.role === "admin"),
    "no admin membership was granted without mailbox verification",
  );

  // 3. The real emailed magic-link/OTP flow lets the verified identity claim.
  console.log(
    "\nAfter real email/OTP verification, the invited member can claim:",
  );
  await mailpitClear();
  const otpRequest = await authFetch("/auth/v1/otp", {
    method: "POST",
    body: { email: INVITED_MEMBER, create_user: true },
  });
  ok(otpRequest.status === 200, "invited-member OTP request is admitted (200)");

  const { token, type } = await mailpitLatestTokenFor(INVITED_MEMBER);
  const verify = await authFetch("/auth/v1/verify", {
    method: "POST",
    body: { type, token_hash: token },
  });
  ok(
    verify.status === 200 && Boolean(verify.json?.access_token),
    "emailed token verification issues a real session",
  );
  ok(
    Boolean(verify.json?.user?.email_confirmed_at),
    "verified identity has email_confirmed_at set",
  );

  const session = verify.json?.access_token;
  const claim = await authFetch("/rest/v1/rpc/claim_invitations", {
    method: "POST",
    token: session ?? ANON_KEY,
    body: {},
  });
  ok(
    Array.isArray(claim.json) &&
      claim.json.length === 1 &&
      claim.json[0].junto_id === JUNTO_ID &&
      claim.json[0].member_role === "member",
    "verified invited-member claims exactly its member invitation",
  );

  const memberUsers = await adminUsersByEmail(INVITED_MEMBER);
  const memberUserId = memberUsers[0]?.id;
  const membersAfterClaim = await restFetch(
    `/rest/v1/junto_members?junto_id=eq.${JUNTO_ID}&select=user_id,role,status`,
  );
  ok(
    Array.isArray(membersAfterClaim.json) &&
      membersAfterClaim.json.some(
        (m) =>
          m.user_id === memberUserId &&
          m.role === "member" &&
          m.status === "active",
      ),
    "verified invited-member now holds an active member membership",
  );
}

export async function main() {
  // Refuse any non-loopback target before the FIRST network request; the
  // service-role key must never reach a remote stack, not even for a
  // health check or stale-fixture cleanup.
  assertLoopbackTarget("SUPABASE_URL", SUPABASE_URL);
  assertLoopbackTarget("MAILPIT_URL", MAILPIT_URL);

  console.log("Live GoTrue mailbox-ownership regression\n");

  // Stale fixtures from an aborted earlier run are removed (checked) before
  // seeding; a failure here aborts before anything new is created.
  await cleanup();

  let functionalError = null;
  let teardownError = null;
  try {
    await seed();
    await runChecks();
    if (failures > 0) {
      functionalError = new Error(
        `${failures}/${checks} functional checks failed`,
      );
    }
  } catch (err) {
    functionalError = err;
  } finally {
    // Teardown always runs and fails closed; it must not mask a functional
    // failure, and a teardown failure alone must still fail the run.
    try {
      await cleanup();
      await verifyFixturesAbsent();
    } catch (err) {
      teardownError = err;
    }
  }
  return { functionalError, teardownError, checks, failures };
}

export function exitCodeFor({ functionalError, teardownError }) {
  return functionalError || teardownError ? 1 : 0;
}

async function run() {
  const outcome = await main();
  console.log(
    `\n${outcome.checks - outcome.failures}/${outcome.checks} checks passed; ${outcome.failures} failed.`,
  );
  if (outcome.functionalError) {
    console.error(`Functional failure: ${outcome.functionalError.message}`);
  }
  if (outcome.teardownError) {
    console.error(
      `Teardown failure (fixtures may remain): ${outcome.teardownError.message}`,
    );
  }
  process.exit(exitCodeFor(outcome));
}

// Importing this module (e.g. from harness-safety.test.mjs) must not start a
// run or touch the network.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((err) => {
    console.error("\nRegression harness error:", err);
    process.exit(1);
  });
}
