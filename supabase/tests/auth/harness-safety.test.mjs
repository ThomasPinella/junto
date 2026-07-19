#!/usr/bin/env node
// Safety self-checks for the live GoTrue regression harness
// (verify-mailbox-ownership.mjs). The harness uses service-role credentials
// to delete and insert fixtures, so it must be impossible to point it at a
// non-loopback Supabase or Mailpit endpoint — including indirectly, via an
// HTTP redirect from an accepted loopback responder — and its teardown must
// fail closed and exhaust every fixture identity.
//
// These checks are deterministic and never contact any network endpoint:
// every security proof stubs global fetch in-process (recording exact call
// URLs, methods, and redirect options), and the child-process checks use
// reserved `.invalid` hostnames. The child-process section only demonstrates
// standard-invocation refusal; the zero-fetch in-process proofs are the
// evidence that no request is attempted.
//
// Runs without the local Supabase stack.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HARNESS_URL = new URL("./verify-mailbox-ownership.mjs", import.meta.url);
const HARNESS_PATH = fileURLToPath(HARNESS_URL);

// Loopback defaults the harness falls back to when the env is unset; the
// simulated-stack proofs assert every request stays on these origins.
const LOCAL_SUPABASE = "http://127.0.0.1:54321";
const LOCAL_MAILPIT = "http://127.0.0.1:54324";

// Fixture identifiers, used to build realistic simulated-stack responses.
// Read from the harness's FIXTURES export; the fallback (kept in sync with
// verify-mailbox-ownership.mjs) only lets a RED run against an older harness
// fail with assertions instead of crashing.
const FIXTURE_FALLBACK = {
  juntoId: "c0300000-0000-4a00-8a00-000000000001",
  juntoSlug: "c03-auth-regression",
  invitedAdmin: "c03-invited-admin@example.com",
  invitedMember: "c03-invited-member@example.com",
  uninvited: "c03-uninvited@example.com",
};

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

// Import the harness module without triggering a run (it must be
// side-effect-free on import). A query string busts the module cache so later
// sections can re-import it under mutated env.
async function importHarness(tag) {
  return import(`${HARNESS_URL.href}?${tag}`);
}

function jsonResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

// Every stub records the exact URL, method, and redirect option of each
// fetch invocation so assertions can be about concrete request behavior.
function record(calls, input, init) {
  calls.push({
    url: String(input),
    method: init.method ?? "GET",
    redirect: "redirect" in init ? init.redirect : "(unset)",
  });
}

// Path-aware fetch stub simulating a healthy, already-clean local stack.
function cleanStackStub(calls) {
  return async (input, init = {}) => {
    record(calls, input, init);
    const url = String(input);
    const method = init.method ?? "GET";
    if (url.includes("/auth/v1/admin/users?")) {
      return jsonResponse('{"users":[]}');
    }
    if (url.includes("/rest/v1/")) {
      return method === "DELETE" ? emptyResponse(204) : jsonResponse("[]");
    }
    if (url.includes("/api/v1/messages")) {
      return method === "DELETE"
        ? emptyResponse(200)
        : jsonResponse('{"messages":[]}');
    }
    return jsonResponse("{}", 404);
  };
}

// Clean-stack stub with targeted overrides: the first override whose `match`
// substring (and optional method) matches the request wins.
function overlayStub(calls, overrides) {
  const base = cleanStackStub([]);
  return async (input, init = {}) => {
    record(calls, input, init);
    const url = String(input);
    const method = init.method ?? "GET";
    for (const o of overrides) {
      if (url.includes(o.match) && (!o.method || o.method === method)) {
        return o.respond(input, init);
      }
    }
    return base(input, init);
  };
}

// Simulates a compliant WHATWG fetch facing a compromised loopback responder
// that answers every request with a 307 redirect to a remote origin. With
// redirect:"follow" (Node's default) the method, body, and custom headers
// such as the service-role `apikey` survive the cross-origin hop, so the
// stub re-issues the request to the remote origin exactly as undici would.
// With redirect:"error" a compliant fetch rejects without a second request.
const REDIRECT_REMOTE = "https://attacker-collector.invalid";
function redirectAttackStub(calls) {
  const handler = async (input, init = {}) => {
    record(calls, input, init);
    const url = String(input);
    if (url.startsWith(REDIRECT_REMOTE)) {
      // A privileged request reached the remote origin: the attack worked.
      return jsonResponse('{"captured":true}');
    }
    const mode = init.redirect ?? "follow";
    if (mode === "error") {
      throw new TypeError("fetch failed: redirect mode is error");
    }
    if (mode === "follow") {
      return handler(`${REDIRECT_REMOTE}/captured`, init);
    }
    return new Response(null, {
      status: 307,
      headers: { location: `${REDIRECT_REMOTE}/captured` },
    });
  };
  return handler;
}

// Stateful stub simulating a fully healthy local stack (GoTrue + PostgREST +
// Mailpit) with realistic strict response shapes, so the complete in-process
// main() run — 19 functional checks plus preparation and teardown — passes.
// It is deliberately closed-world: any unexpected method/path combination,
// unscoped privileged mutation, malformed seed body, or out-of-sequence
// admission attempt throws, so a harness that drifts from the documented
// request flow cannot pass. Invitation admission is modeled from the seeded
// invitations (as the before_user_created hook does), not from hardcoded
// email comparisons, so a missing or wrong invitation seed breaks the flow.
function simulatedHealthyStack(FIX, calls) {
  const state = {
    juntoSeeded: false,
    invitations: [],
    users: [],
    members: [],
    mailbox: [],
  };
  const TOKEN = "simtoken123abc";
  const SESSION = "sim-member-session";
  const USER_IDS = {
    [FIX.invitedAdmin]: "u-admin",
    [FIX.invitedMember]: "u-member",
  };
  return async (input, init = {}) => {
    record(calls, input, init);
    const u = new URL(String(input));
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    const reject = (detail) => {
      throw new Error(
        `simulated stack rejected ${method} ${u.pathname}: ${detail}`,
      );
    };
    const pendingInvitation = (email) =>
      state.invitations.find(
        (i) => i.email_normalized === email && i.status === "pending",
      );

    // GoTrue
    if (u.pathname === "/auth/v1/signup" && method === "POST") {
      if (typeof body?.email !== "string" || typeof body?.password !== "string")
        reject("signup requires an email and a password");
      if (!pendingInvitation(body.email)) {
        return jsonResponse('{"msg":"Sign-ups are by invitation only."}', 403);
      }
      state.users.push({
        id: USER_IDS[body.email],
        email: body.email,
        email_confirmed_at: null,
      });
      return jsonResponse(
        JSON.stringify({
          id: USER_IDS[body.email],
          email: body.email,
          email_confirmed_at: null,
        }),
      );
    }
    if (u.pathname === "/auth/v1/otp" && method === "POST") {
      if (typeof body?.email !== "string" || body?.create_user !== true)
        reject("otp requires an email and create_user");
      if (!pendingInvitation(body.email)) {
        return jsonResponse('{"msg":"Sign-ups are by invitation only."}', 403);
      }
      state.users.push({
        id: USER_IDS[body.email],
        email: body.email,
        email_confirmed_at: null,
      });
      state.mailbox.push({ ID: "m1", To: [{ Address: body.email }] });
      return jsonResponse("{}");
    }
    if (u.pathname === "/auth/v1/verify" && method === "POST") {
      const member = state.users.find((x) => x.email === FIX.invitedMember);
      if (body?.type !== "magiclink" || body?.token_hash !== TOKEN || !member)
        reject("verify requires the emailed magiclink token of a seeded user");
      member.email_confirmed_at = "2026-07-19T00:00:00Z";
      return jsonResponse(
        JSON.stringify({ access_token: SESSION, user: member }),
      );
    }
    if (u.pathname === "/auth/v1/token" && method === "POST") {
      if (u.searchParams.get("grant_type") !== "password")
        reject("only the password grant is modeled");
      const user = state.users.find((x) => x.email === body?.email);
      if (!user || typeof body?.password !== "string")
        reject("password grant requires an existing user email and password");
      if (user.email_confirmed_at === null) {
        return jsonResponse('{"error_code":"email_not_confirmed"}', 400);
      }
      reject("no confirmed-user password grant occurs in the healthy flow");
    }
    if (u.pathname === "/auth/v1/admin/users" && method === "GET") {
      const email = u.searchParams.get("filter");
      if (!email) reject("admin user listing requires a filter");
      return jsonResponse(
        JSON.stringify({ users: state.users.filter((x) => x.email === email) }),
      );
    }
    if (u.pathname.startsWith("/auth/v1/admin/users/") && method === "DELETE") {
      const id = u.pathname.split("/").pop();
      if (!state.users.some((x) => x.id === id))
        reject(`no such auth user "${id}"`);
      state.users = state.users.filter((x) => x.id !== id);
      return jsonResponse("{}");
    }

    // PostgREST
    if (u.pathname === "/rest/v1/rpc/claim_invitations" && method === "POST") {
      const member = state.users.find((x) => x.email === FIX.invitedMember);
      const invitation = pendingInvitation(FIX.invitedMember);
      if (
        init.headers?.Authorization !== `Bearer ${SESSION}` ||
        !member ||
        member.email_confirmed_at === null ||
        !invitation
      )
        reject(
          "claiming requires the verified member session and a pending invitation",
        );
      invitation.status = "claimed";
      state.members.push({
        user_id: member.id,
        role: invitation.role,
        status: "active",
      });
      return jsonResponse(
        JSON.stringify([
          { junto_id: FIX.juntoId, member_role: invitation.role },
        ]),
      );
    }
    if (u.pathname === "/rest/v1/junto_members") {
      if (u.searchParams.get("junto_id") !== `eq.${FIX.juntoId}`)
        reject("junto_members access must be scoped to the fixture junto");
      if (method === "DELETE") {
        state.members = [];
        return emptyResponse(204);
      }
      if (method === "GET") return jsonResponse(JSON.stringify(state.members));
      reject("unmodeled junto_members method");
    }
    if (u.pathname === "/rest/v1/junto_invitations") {
      if (method === "POST") {
        if (!state.juntoSeeded)
          reject("invitations must be seeded after the junto");
        const expected = [
          { email: FIX.invitedAdmin, role: "admin" },
          { email: FIX.invitedMember, role: "member" },
        ];
        const exact =
          Array.isArray(body) &&
          body.length === expected.length &&
          expected.every((e) =>
            body.some(
              (i) =>
                i.junto_id === FIX.juntoId &&
                i.email_normalized === e.email &&
                i.role === e.role &&
                i.status === "pending",
            ),
          );
        if (!exact)
          reject(
            "invitation seed body must carry exactly the two pending fixture invitations",
          );
        state.invitations = body.map((i) => ({ ...i }));
        return emptyResponse(201);
      }
      if (u.searchParams.get("junto_id") !== `eq.${FIX.juntoId}`)
        reject("junto_invitations access must be scoped to the fixture junto");
      if (method === "DELETE") {
        state.invitations = [];
        return emptyResponse(204);
      }
      if (method === "GET") return jsonResponse("[]");
      reject("unmodeled junto_invitations method");
    }
    if (u.pathname === "/rest/v1/juntos") {
      if (method === "POST") {
        if (
          body?.id !== FIX.juntoId ||
          body?.slug !== FIX.juntoSlug ||
          typeof body?.name !== "string" ||
          body.name.length === 0 ||
          body?.status !== "active" ||
          body?.archive_visibility !== "public"
        )
          reject("junto seed body must carry the exact fixture junto");
        state.juntoSeeded = true;
        return emptyResponse(201);
      }
      if (u.searchParams.get("id") !== `eq.${FIX.juntoId}`)
        reject("juntos access must be scoped to the fixture junto");
      if (method === "DELETE") {
        state.juntoSeeded = false;
        return emptyResponse(204);
      }
      if (method === "GET") return jsonResponse("[]");
      reject("unmodeled juntos method");
    }

    // Mailpit
    if (u.pathname === "/api/v1/messages") {
      if (method === "DELETE") {
        state.mailbox = [];
        return emptyResponse(200);
      }
      if (method === "GET")
        return jsonResponse(JSON.stringify({ messages: state.mailbox }));
      reject("unmodeled Mailpit messages method");
    }
    if (u.pathname.startsWith("/api/v1/message/") && method === "GET") {
      const id = u.pathname.split("/").pop();
      if (!state.mailbox.some((m) => m.ID === id))
        reject(`no such Mailpit message "${id}"`);
      return jsonResponse(
        JSON.stringify({
          Text: `Confirm: ${LOCAL_SUPABASE}/verify?token=${TOKEN}&type=magiclink`,
          HTML: "",
        }),
      );
    }
    reject("no handler models this request");
  };
}

// The complete request trace main() must produce against the healthy
// simulated stack, in order: preparation cleanup (7), seed (2), the
// functional flow (17), final cleanup (9, including the two created auth
// users), and absence verification (7) — 42 requests. The simulated stack is
// deterministic, so every URL is exact; the fixture identifiers are the only
// values that would need normalizing against a real stack, and they are
// pinned constants here.
function expectedHealthyTrace(FIX) {
  const adminList = (email) => [
    "GET",
    `${LOCAL_SUPABASE}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
  ];
  const membersScoped = `${LOCAL_SUPABASE}/rest/v1/junto_members?junto_id=eq.${FIX.juntoId}`;
  const invitationsScoped = `${LOCAL_SUPABASE}/rest/v1/junto_invitations?junto_id=eq.${FIX.juntoId}`;
  const juntoScoped = `${LOCAL_SUPABASE}/rest/v1/juntos?id=eq.${FIX.juntoId}`;
  const fkSafeCleanup = (adminDeletes) => [
    ["DELETE", membersScoped],
    ["DELETE", invitationsScoped],
    adminList(FIX.invitedAdmin),
    ...(adminDeletes
      ? [["DELETE", `${LOCAL_SUPABASE}/auth/v1/admin/users/u-admin`]]
      : []),
    adminList(FIX.invitedMember),
    ...(adminDeletes
      ? [["DELETE", `${LOCAL_SUPABASE}/auth/v1/admin/users/u-member`]]
      : []),
    adminList(FIX.uninvited),
    ["DELETE", juntoScoped],
    ["DELETE", `${LOCAL_MAILPIT}/api/v1/messages`],
  ];
  return [
    // Preparation cleanup against an already-clean stack: no users to delete.
    ...fkSafeCleanup(false),
    // Seed: the junto, then its two invitations.
    ["POST", `${LOCAL_SUPABASE}/rest/v1/juntos`],
    ["POST", `${LOCAL_SUPABASE}/rest/v1/junto_invitations`],
    // Functional 1: uninvited signup and OTP are rejected with no auth user.
    ["POST", `${LOCAL_SUPABASE}/auth/v1/signup`],
    adminList(FIX.uninvited),
    ["POST", `${LOCAL_SUPABASE}/auth/v1/otp`],
    adminList(FIX.uninvited),
    // Functional 2: invited admin cannot claim before mailbox verification.
    ["DELETE", `${LOCAL_MAILPIT}/api/v1/messages`],
    ["POST", `${LOCAL_SUPABASE}/auth/v1/signup`],
    adminList(FIX.invitedAdmin),
    ["POST", `${LOCAL_SUPABASE}/auth/v1/token?grant_type=password`],
    ["GET", `${membersScoped}&select=user_id,role,status`],
    // Functional 3: emailed-token verification, then the member claims.
    ["DELETE", `${LOCAL_MAILPIT}/api/v1/messages`],
    ["POST", `${LOCAL_SUPABASE}/auth/v1/otp`],
    ["GET", `${LOCAL_MAILPIT}/api/v1/messages`],
    ["GET", `${LOCAL_MAILPIT}/api/v1/message/m1`],
    ["POST", `${LOCAL_SUPABASE}/auth/v1/verify`],
    ["POST", `${LOCAL_SUPABASE}/rest/v1/rpc/claim_invitations`],
    adminList(FIX.invitedMember),
    ["GET", `${membersScoped}&select=user_id,role,status`],
    // Final cleanup: now also deletes the two created auth users.
    ...fkSafeCleanup(true),
    // Absence verification.
    ["GET", `${membersScoped}&select=user_id`],
    ["GET", `${invitationsScoped}&select=id`],
    ["GET", `${juntoScoped}&select=id`],
    adminList(FIX.invitedAdmin),
    adminList(FIX.invitedMember),
    adminList(FIX.uninvited),
    ["GET", `${LOCAL_MAILPIT}/api/v1/messages`],
  ].map(([method, url]) => ({ method, url }));
}

// Stateful stub for the main() teardown-failure scenario: healthy until the
// junto is seeded, then admin listings return malformed HTTP 200 (functional
// failure), the junto_members delete returns 500 (cleanup failure), and a
// residual junto_members row plus a lingering fixture email remain visible
// (verification failure).
function teardownFailureStub(FIX, calls) {
  let seeded = false;
  const TOKEN = "tokredteardown1";
  return async (input, init = {}) => {
    record(calls, input, init);
    const u = new URL(String(input));
    const method = init.method ?? "GET";
    if (u.pathname === "/rest/v1/juntos" && method === "POST") {
      seeded = true;
      return emptyResponse(201);
    }
    if (u.pathname === "/auth/v1/admin/users" && method === "GET") {
      return jsonResponse(seeded ? "{}" : '{"users":[]}');
    }
    if (u.pathname.startsWith("/auth/v1/admin/users/") && method === "DELETE") {
      return jsonResponse("{}");
    }
    if (u.pathname === "/auth/v1/signup" && method === "POST") {
      return jsonResponse('{"msg":"Sign-ups are by invitation only."}', 403);
    }
    if (u.pathname === "/auth/v1/otp" && method === "POST") {
      return jsonResponse("{}");
    }
    if (u.pathname === "/auth/v1/verify" && method === "POST") {
      return jsonResponse("{}", 404);
    }
    if (u.pathname === "/auth/v1/token" && method === "POST") {
      return jsonResponse('{"error_code":"email_not_confirmed"}', 400);
    }
    if (u.pathname === "/rest/v1/junto_members") {
      if (method === "DELETE") {
        return seeded ? jsonResponse('{"msg":"boom"}', 500) : emptyResponse();
      }
      return jsonResponse(seeded ? '[{"user_id":"residue"}]' : "[]");
    }
    if (
      u.pathname === "/rest/v1/junto_invitations" ||
      u.pathname === "/rest/v1/juntos"
    ) {
      if (method === "POST") return emptyResponse(201);
      if (method === "DELETE") return emptyResponse(204);
      return jsonResponse("[]");
    }
    if (u.pathname === "/api/v1/messages") {
      if (method === "DELETE") return emptyResponse(200);
      return jsonResponse(
        JSON.stringify({
          messages: [{ ID: "m1", To: [{ Address: FIX.invitedMember }] }],
        }),
      );
    }
    if (u.pathname.startsWith("/api/v1/message/")) {
      return jsonResponse(
        JSON.stringify({ Text: `?token=${TOKEN}&type=magiclink`, HTML: "" }),
      );
    }
    return jsonResponse("{}", 404);
  };
}

async function withStubbedFetch(stub, fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

// The in-process main() scenarios legitimately print the harness's own check
// output; mute it so this test's output stays readable.
async function withMutedConsole(fn) {
  const savedLog = console.log;
  const savedError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = savedLog;
    console.error = savedError;
  }
}

async function withEnv(overrides, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(overrides)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function rejection(promise) {
  try {
    await promise;
    return null;
  } catch (err) {
    return err;
  }
}

function runHarness(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HARNESS_PATH], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function main() {
  console.log("Live-Auth harness safety self-checks\n");

  // Pin the harness to its loopback defaults regardless of ambient env; the
  // remote-target sections set their own overrides explicitly.
  for (const k of [
    "SUPABASE_URL",
    "MAILPIT_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    delete process.env[k];
  }

  // ── 1. Loopback guard unit behavior ────────────────────────────────────
  console.log("Loopback target guard accepts only explicit loopback hosts:");
  const harness = await importHarness("guard");
  const { assertLoopbackTarget } = harness;
  ok(
    typeof assertLoopbackTarget === "function",
    "harness exports assertLoopbackTarget",
  );
  const FIX = harness.FIXTURES ?? FIXTURE_FALLBACK;

  const accepted = [
    "http://localhost:54321",
    "http://LOCALHOST:54321",
    "https://localhost",
    "http://127.0.0.1:54321",
    "http://127.1.2.3:9999",
    "http://[::1]:54324",
    "http://[0:0:0:0:0:0:0:1]:54324",
  ];
  for (const url of accepted) {
    let threw = null;
    try {
      assertLoopbackTarget?.("TEST_URL", url);
    } catch (err) {
      threw = err;
    }
    ok(threw === null, `accepts ${url}`);
  }

  const rejected = [
    "https://example-project.supabase.co",
    "http://db.staging.internal:54321",
    "http://10.0.0.5:54321",
    "http://192.168.1.20:54321",
    "http://169.254.169.254",
    "http://127.0.0.1.evil.example:54321",
    "http://localhost.evil.example:54321",
    "http://[::2]:54321",
    "http://[2001:db8::1]:54321",
    "http://[::ffff:127.0.0.1]:54321",
    "ftp://127.0.0.1",
    "not a url at all",
    "",
  ];
  for (const url of rejected) {
    let threw = null;
    try {
      assertLoopbackTarget?.("TEST_URL", url);
    } catch (err) {
      threw = err;
    }
    ok(threw !== null, `rejects ${JSON.stringify(url)}`);
    ok(
      threw === null || !/eyJ/.test(threw.message),
      `rejection message for ${JSON.stringify(url)} carries no credential material`,
    );
  }

  // ── 2. Remote targets are refused before ANY network request ───────────
  console.log(
    "\nRemote env targets are refused before any fetch (service-role mutations impossible):",
  );
  {
    const calls = [];
    const err = await withEnv(
      { SUPABASE_URL: "https://example-project.supabase.co" },
      () =>
        withStubbedFetch(
          async (input, init = {}) => {
            record(calls, input, init);
            throw new Error("network request attempted");
          },
          async () => {
            const mod = await importHarness("remote-supabase");
            return withMutedConsole(() => rejection(mod.main()));
          },
        ),
    );
    ok(err !== null, "main() rejects a remote SUPABASE_URL");
    ok(
      err !== null && /loopback/i.test(err.message),
      "remote SUPABASE_URL rejection names the loopback requirement",
    );
    ok(
      calls.length === 0,
      `no network request occurred before rejection (saw ${calls.length})`,
    );
  }
  {
    const calls = [];
    const err = await withEnv(
      { MAILPIT_URL: "http://mailpit.staging.internal:54324" },
      () =>
        withStubbedFetch(
          async (input, init = {}) => {
            record(calls, input, init);
            throw new Error("network request attempted");
          },
          async () => {
            const mod = await importHarness("remote-mailpit");
            return withMutedConsole(() => rejection(mod.main()));
          },
        ),
    );
    ok(err !== null, "main() rejects a remote MAILPIT_URL");
    ok(
      calls.length === 0,
      `no network request occurred before rejection (saw ${calls.length})`,
    );
  }

  // Directly invoked exported helpers must inherit the request-level guard;
  // they cannot rely on main()'s up-front checks.
  console.log(
    "\nDirectly invoked helpers refuse remote targets at the request layer:",
  );
  {
    const calls = [];
    const mod = await withEnv(
      { SUPABASE_URL: "https://example-project.supabase.co" },
      () => importHarness("remote-supabase-helpers"),
    );
    const cleanupErr = await withEnv(
      { SUPABASE_URL: "https://example-project.supabase.co" },
      () =>
        withStubbedFetch(
          async (input, init = {}) => {
            record(calls, input, init);
            throw new Error("network request attempted");
          },
          () => rejection(mod.cleanup()),
        ),
    );
    ok(
      cleanupErr !== null && /loopback/i.test(cleanupErr.message),
      "direct cleanup() under a remote SUPABASE_URL rejects with the loopback policy",
    );
    ok(
      cleanupErr !== null && !/eyJ/.test(cleanupErr.message),
      "direct cleanup() refusal carries no credential material",
    );
    // The Mailpit clear still targets the loopback default, so loopback
    // Mailpit calls are legitimate; no call may reach the remote Supabase.
    ok(
      calls.every((c) => c.url.startsWith(LOCAL_MAILPIT)),
      `direct cleanup() sent every Supabase-bound request nowhere (non-loopback-Mailpit calls: ${calls.filter((c) => !c.url.startsWith(LOCAL_MAILPIT)).length})`,
    );
    const verifyCalls = [];
    const verifyErr = await withEnv(
      { SUPABASE_URL: "https://example-project.supabase.co" },
      () =>
        withStubbedFetch(
          async (input, init = {}) => {
            record(verifyCalls, input, init);
            throw new Error("network request attempted");
          },
          () => rejection(mod.verifyFixturesAbsent()),
        ),
    );
    ok(
      verifyErr !== null && /loopback/i.test(verifyErr.message),
      "direct verifyFixturesAbsent() under a remote SUPABASE_URL rejects with the loopback policy",
    );
    ok(
      verifyCalls.every((c) => c.url.startsWith(LOCAL_MAILPIT)),
      `direct verifyFixturesAbsent() sent every Supabase-bound request nowhere (non-loopback-Mailpit calls: ${verifyCalls.filter((c) => !c.url.startsWith(LOCAL_MAILPIT)).length})`,
    );
  }
  {
    const REMOTE_MAILPIT = "http://mailpit.remote.invalid:54324";
    const mod = await withEnv({ MAILPIT_URL: REMOTE_MAILPIT }, () =>
      importHarness("remote-mailpit-helpers"),
    );
    const calls = [];
    const cleanupErr = await withEnv({ MAILPIT_URL: REMOTE_MAILPIT }, () =>
      withStubbedFetch(cleanStackStub(calls), () => rejection(mod.cleanup())),
    );
    ok(
      cleanupErr !== null && /loopback/i.test(cleanupErr.message),
      "direct cleanup() under a remote MAILPIT_URL rejects the Mailpit request",
    );
    ok(
      calls.every((c) => !c.url.includes("mailpit.remote.invalid")),
      "no request reached the remote Mailpit host during cleanup()",
    );
    const verifyCalls = [];
    const verifyErr = await withEnv({ MAILPIT_URL: REMOTE_MAILPIT }, () =>
      withStubbedFetch(cleanStackStub(verifyCalls), () =>
        rejection(mod.verifyFixturesAbsent()),
      ),
    );
    ok(
      verifyErr !== null && /loopback/i.test(verifyErr.message),
      "direct verifyFixturesAbsent() under a remote MAILPIT_URL rejects the Mailpit request",
    );
    ok(
      verifyCalls.every((c) => !c.url.includes("mailpit.remote.invalid")),
      "no request reached the remote Mailpit host during verifyFixturesAbsent()",
    );
  }

  // ── 3. Standard invocation (child process) also refuses remote targets ─
  // This section demonstrates the refusal path under standard `node
  // <harness>` invocation only; the in-process zero-fetch assertions above
  // are the proof that no request is attempted.
  console.log("\nStandard `node <harness>` invocation refuses remote targets:");
  {
    const { code, out } = await runHarness({
      SUPABASE_URL: "https://c04-refused.supabase.invalid",
    });
    ok(code !== 0, "exits nonzero for a remote SUPABASE_URL");
    ok(/loopback/i.test(out), "output names the loopback requirement");
    ok(
      !/fetch failed/i.test(out),
      "refusal comes from the guard, not a network failure",
    );
  }
  {
    const { code, out } = await runHarness({
      MAILPIT_URL: "http://c04-refused.mailpit.invalid",
    });
    ok(code !== 0, "exits nonzero for a remote MAILPIT_URL");
    ok(/loopback/i.test(out), "output names the loopback requirement");
    ok(
      !/fetch failed/i.test(out),
      "refusal comes from the guard, not a network failure",
    );
  }

  // ── 4. Redirects are refused at the request layer ──────────────────────
  console.log(
    "\nA redirecting loopback responder cannot forward privileged requests:",
  );
  {
    const calls = [];
    const err = await withStubbedFetch(redirectAttackStub(calls), () =>
      rejection(harness.cleanup()),
    );
    ok(err !== null, "cleanup() fails when the responder redirects");
    ok(
      calls.length === 7 && calls.every((c) => c.redirect === "error"),
      `every cleanup request passes redirect:"error" (saw ${calls
        .map((c) => c.redirect)
        .join(", ")})`,
    );
    ok(
      calls.every((c) => !c.url.startsWith(REDIRECT_REMOTE)),
      "no second request reached the redirect target origin",
    );
    ok(
      err !== null && !/eyJ/.test(err.message),
      "redirect failure carries no credential material",
    );
  }
  {
    const calls = [];
    const err = await withStubbedFetch(redirectAttackStub(calls), () =>
      rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err !== null,
      "verifyFixturesAbsent() fails when the responder redirects",
    );
    ok(
      calls.length === 7 && calls.every((c) => c.redirect === "error"),
      `every verification request passes redirect:"error" (saw ${calls
        .map((c) => c.redirect)
        .join(", ")})`,
    );
    ok(
      calls.every((c) => !c.url.startsWith(REDIRECT_REMOTE)),
      "no verification request reached the redirect target origin",
    );
  }

  // ── 5. Successful responses must have strict shapes ────────────────────
  console.log("\nMalformed HTTP-200 bodies fail closed:");
  for (const bodyText of ["{}", '{"users":null}', '{"users":{}}']) {
    const calls = [];
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/auth/v1/admin/users?",
          respond: () => jsonResponse(bodyText),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err !== null && /malformed/i.test(err.message),
      `admin user list body ${bodyText} is rejected as malformed`,
    );
  }
  for (const bodyText of ["{}", '{"messages":null}', '{"messages":{}}']) {
    const calls = [];
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/api/v1/messages",
          method: "GET",
          respond: () => jsonResponse(bodyText),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err !== null && /malformed/i.test(err.message),
      `Mailpit message list body ${bodyText} is rejected as malformed`,
    );
  }
  {
    const calls = [];
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/rest/v1/junto_members?",
          method: "GET",
          respond: () => jsonResponse('{"rows":[]}'),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err !== null && /junto_members/.test(err.message),
      "non-array PostgREST body for an absence proof fails closed",
    );
  }
  {
    const fn = harness.mailpitLatestTokenFor;
    ok(
      typeof fn === "function",
      "harness exports mailpitLatestTokenFor for the polling-shape proof",
    );
    if (typeof fn === "function") {
      const calls = [];
      const err = await withStubbedFetch(
        overlayStub(calls, [
          {
            match: "/api/v1/messages",
            method: "GET",
            respond: () => jsonResponse('{"total":0}'),
          },
        ]),
        () => rejection(fn(FIX.invitedMember, { attempts: 3, delayMs: 1 })),
      );
      ok(
        err !== null && /malformed/i.test(err.message),
        "verification-email polling fails closed on a malformed HTTP-200 list",
      );
    } else {
      ok(
        false,
        "verification-email polling fails closed on a malformed HTTP-200 list",
      );
    }
  }

  const nestedCanary = "C29_NESTED_SECRET_CANARY";
  const assertSchemaFailure = (err, fieldPattern, label) => {
    ok(
      err !== null &&
        /malformed response body/i.test(err.message) &&
        fieldPattern.test(err.message) &&
        !err.message.includes(nestedCanary) &&
        !/eyJ|Bearer|Authorization|apikey/.test(err.message),
      label,
    );
  };

  console.log(
    "\nMalformed nested Auth users fail closed during absence checks:",
  );
  const malformedAuthUsers = [
    ["user object", null, /users\[0\].*object/i],
    ["missing id", { email: FIX.invitedAdmin }, /users\[0\]\.id/i],
    ["non-string id", { id: 7, email: FIX.invitedAdmin }, /users\[0\]\.id/i],
    ["blank id", { id: "   ", email: FIX.invitedAdmin }, /users\[0\]\.id/i],
    ["missing email", { id: "user-1" }, /users\[0\]\.email/i],
    ["non-string email", { id: "user-1", email: 7 }, /users\[0\]\.email/i],
    ["blank email", { id: "user-1", email: "   " }, /users\[0\]\.email/i],
  ];
  for (const [caseName, user, fieldPattern] of malformedAuthUsers) {
    const calls = [];
    const body = { users: [user], opaque: nestedCanary };
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/auth/v1/admin/users?",
          respond: () => jsonResponse(JSON.stringify(body)),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    assertSchemaFailure(
      err,
      fieldPattern,
      `Auth ${caseName} is rejected with fixed schema-only diagnostics`,
    );
    ok(
      calls.length === 7 &&
        calls.at(-1)?.method === "GET" &&
        calls.at(-1)?.url.includes("/api/v1/messages"),
      `Auth ${caseName} does not short-circuit independent absence phases`,
    );
  }
  {
    const calls = [];
    const normalizedVariant = `  ${FIX.invitedAdmin.toUpperCase()}  `;
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: `filter=${encodeURIComponent(FIX.invitedAdmin)}`,
          respond: () =>
            jsonResponse(
              JSON.stringify({
                users: [{ id: "user-normalized", email: normalizedVariant }],
              }),
            ),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err !== null && /auth user/.test(err.message),
      "valid Auth email strings are normalized before fixture comparison",
    );
  }

  console.log(
    "\nMalformed nested Mailpit summaries fail closed during absence checks:",
  );
  const malformedMailpitSummaries = [
    ["summary object", null, /messages\[0\].*object/i],
    ["missing id", { To: [] }, /messages\[0\]\.ID/i],
    ["non-string id", { ID: 7, To: [] }, /messages\[0\]\.ID/i],
    ["blank id", { ID: "   ", To: [] }, /messages\[0\]\.ID/i],
    ["missing To", { ID: "m1" }, /messages\[0\]\.To/i],
    ["non-array To", { ID: "m1", To: {} }, /messages\[0\]\.To/i],
    ["recipient object", { ID: "m1", To: [null] }, /To\[0\].*object/i],
    ["missing address", { ID: "m1", To: [{}] }, /To\[0\]\.Address/i],
    [
      "non-string address",
      { ID: "m1", To: [{ Address: 7 }] },
      /To\[0\]\.Address/i,
    ],
    [
      "blank address",
      { ID: "m1", To: [{ Address: "   " }] },
      /To\[0\]\.Address/i,
    ],
  ];
  for (const [caseName, summary, fieldPattern] of malformedMailpitSummaries) {
    const calls = [];
    const body = { messages: [summary], opaque: nestedCanary };
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/api/v1/messages",
          method: "GET",
          respond: () => jsonResponse(JSON.stringify(body)),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    assertSchemaFailure(
      err,
      fieldPattern,
      `Mailpit ${caseName} is rejected with fixed schema-only diagnostics`,
    );
    ok(
      calls.length === 7 &&
        calls.filter((c) => c.url.includes("/auth/v1/admin/users?filter="))
          .length === 3,
      `Mailpit ${caseName} runs every earlier independent absence phase`,
    );
  }
  {
    const calls = [];
    const normalizedVariant = `  ${FIX.invitedMember.toUpperCase()}  `;
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/api/v1/messages",
          method: "GET",
          respond: () =>
            jsonResponse(
              JSON.stringify({
                messages: [
                  {
                    ID: "m-normalized",
                    To: [{ Address: normalizedVariant }],
                  },
                ],
              }),
            ),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err !== null && /Mailpit message/.test(err.message),
      "valid Mailpit address strings are normalized before fixture comparison",
    );
  }
  {
    const calls = [];
    const messageId = "message/id?opaque=fragment";
    let result = null;
    let error = null;
    try {
      result = await withStubbedFetch(
        overlayStub(calls, [
          {
            match: "/api/v1/messages",
            method: "GET",
            respond: () =>
              jsonResponse(
                JSON.stringify({
                  messages: [
                    {
                      ID: messageId,
                      To: [{ Address: FIX.invitedMember }],
                    },
                  ],
                }),
              ),
          },
          {
            match: `/api/v1/message/${encodeURIComponent(messageId)}`,
            method: "GET",
            respond: () =>
              jsonResponse(
                JSON.stringify({
                  Text: "?token=encoded123&type=magiclink",
                  HTML: "",
                }),
              ),
          },
        ]),
        () =>
          harness.mailpitLatestTokenFor(FIX.invitedMember, {
            attempts: 1,
            delayMs: 1,
          }),
      );
    } catch (err) {
      error = err;
    }
    ok(
      error === null &&
        result?.token === "encoded123" &&
        result.type === "magiclink" &&
        calls.length === 2 &&
        calls[1].url.endsWith(
          `/api/v1/message/${encodeURIComponent(messageId)}`,
        ) &&
        calls.every((call) => call.redirect === "error"),
      "Mailpit message IDs are encoded into one guarded detail-path segment",
    );
  }

  console.log("\nMalformed Mailpit details fail closed without coercion:");
  const validFixtureMail = JSON.stringify({
    messages: [{ ID: "m-detail", To: [{ Address: FIX.invitedMember }] }],
  });
  const malformedMailpitDetails = [
    ["detail object", null, /expected an object/i],
    ["missing Text", { HTML: nestedCanary }, /Text/i],
    ["non-string Text", { Text: 7, HTML: nestedCanary }, /Text/i],
    ["missing HTML", { Text: nestedCanary }, /HTML/i],
    ["non-string HTML", { Text: nestedCanary, HTML: 7 }, /HTML/i],
  ];
  for (const [caseName, detail, fieldPattern] of malformedMailpitDetails) {
    const calls = [];
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/api/v1/messages",
          method: "GET",
          respond: () => jsonResponse(validFixtureMail),
        },
        {
          match: "/api/v1/message/m-detail",
          method: "GET",
          respond: () => jsonResponse(JSON.stringify(detail)),
        },
      ]),
      () =>
        rejection(
          harness.mailpitLatestTokenFor(FIX.invitedMember, {
            attempts: 3,
            delayMs: 1,
          }),
        ),
    );
    assertSchemaFailure(
      err,
      fieldPattern,
      `Mailpit ${caseName} is rejected with fixed schema-only diagnostics`,
    );
    ok(
      calls.length === 2 &&
        calls[0].url.endsWith("/api/v1/messages") &&
        calls[1].url.endsWith("/api/v1/message/m-detail"),
      `Mailpit ${caseName} fails immediately instead of polling again`,
    );
  }

  console.log("\nNested Auth failures remain exhaustive during cleanup:");
  {
    const calls = [];
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: `filter=${encodeURIComponent(FIX.invitedAdmin)}`,
          respond: () =>
            jsonResponse(
              JSON.stringify({
                users: [{ id: "", email: nestedCanary }],
              }),
            ),
        },
      ]),
      () => rejection(harness.cleanup()),
    );
    assertSchemaFailure(
      err,
      /users\[0\]\.id/i,
      "cleanup rejects a malformed nested Auth user without exposing it",
    );
    ok(
      calls.length === 7 &&
        calls.filter((c) => c.url.includes("/auth/v1/admin/users?filter="))
          .length === 3 &&
        calls.some(
          (c) => c.method === "DELETE" && c.url.includes("/rest/v1/juntos?"),
        ) &&
        calls.at(-1)?.url.endsWith("/api/v1/messages"),
      "malformed nested Auth cleanup still attempts every fixture class and identity",
    );
  }

  // ── 6. Cleanup is exhaustive and fails closed ──────────────────────────
  console.log("\nCleanup attempts every fixture identity and fails closed:");
  {
    // Total outage: every response is HTTP 500. All seven cleanup operations
    // must still be attempted, in FK-safe order, before the aggregate error.
    const calls = [];
    const err = await withStubbedFetch(
      async (input, init = {}) => {
        record(calls, input, init);
        return jsonResponse('{"message":"boom"}', 500);
      },
      () => rejection(harness.cleanup()),
    );
    ok(err !== null, "cleanup() rejects when every response is HTTP 500");
    ok(
      err !== null && /500/.test(err.message),
      "cleanup() failure surfaces the HTTP status",
    );
    const expected = [
      { method: "DELETE", part: "/rest/v1/junto_members" },
      { method: "DELETE", part: "/rest/v1/junto_invitations" },
      { method: "GET", part: "/auth/v1/admin/users?filter=" },
      { method: "GET", part: "/auth/v1/admin/users?filter=" },
      { method: "GET", part: "/auth/v1/admin/users?filter=" },
      { method: "DELETE", part: "/rest/v1/juntos" },
      { method: "DELETE", part: "/api/v1/messages" },
    ];
    ok(
      calls.length === expected.length &&
        expected.every(
          (e, i) =>
            calls[i].method === e.method && calls[i].url.includes(e.part),
        ),
      `all ${expected.length} cleanup operations were attempted in FK-safe order despite failures (saw ${calls.length})`,
    );
  }
  {
    // A listing failure for one fixture email must not stop the remaining
    // emails or the later cleanup classes.
    const calls = [];
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: `filter=${encodeURIComponent(FIX.invitedAdmin)}`,
          respond: () => jsonResponse('{"message":"boom"}', 500),
        },
      ]),
      () => rejection(harness.cleanup()),
    );
    ok(err !== null, "cleanup() rejects when one fixture email listing fails");
    const listings = calls.filter((c) =>
      c.url.includes("/auth/v1/admin/users?filter="),
    );
    ok(
      listings.length === 3,
      `all 3 fixture emails were still listed (saw ${listings.length})`,
    );
    ok(
      calls.some(
        (c) => c.method === "DELETE" && c.url.includes("/rest/v1/juntos?"),
      ),
      "the junto delete was still attempted after the listing failure",
    );
    ok(
      calls.some(
        (c) => c.method === "DELETE" && c.url.includes("/api/v1/messages"),
      ),
      "the Mailpit clear was still attempted after the listing failure",
    );
  }
  {
    // A delete failure for one auth user must not stop the remaining users
    // of the same email or the remaining fixture emails.
    const calls = [];
    const usersFor = (email) => {
      if (email === FIX.invitedAdmin) {
        return [
          { id: "u-a1", email },
          { id: "u-a2", email },
        ];
      }
      if (email === FIX.invitedMember) return [{ id: "u-m1", email }];
      return [];
    };
    const base = cleanStackStub([]);
    const err = await withStubbedFetch(
      async (input, init = {}) => {
        record(calls, input, init);
        const u = new URL(String(input));
        const method = init.method ?? "GET";
        if (u.pathname === "/auth/v1/admin/users" && method === "GET") {
          return jsonResponse(
            JSON.stringify({ users: usersFor(u.searchParams.get("filter")) }),
          );
        }
        if (u.pathname === "/auth/v1/admin/users/u-a1" && method === "DELETE") {
          return jsonResponse('{"message":"boom"}', 500);
        }
        if (
          u.pathname.startsWith("/auth/v1/admin/users/") &&
          method === "DELETE"
        ) {
          return jsonResponse("{}");
        }
        return base(input, init);
      },
      () => rejection(harness.cleanup()),
    );
    ok(err !== null, "cleanup() rejects when one auth-user delete fails");
    ok(
      err !== null && /500/.test(err.message),
      "the failed auth-user delete is reported with its status",
    );
    const deletes = calls
      .filter(
        (c) => c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/"),
      )
      .map((c) => c.url.split("/").pop());
    ok(
      deletes.length === 3 &&
        deletes.includes("u-a1") &&
        deletes.includes("u-a2") &&
        deletes.includes("u-m1"),
      `every fixture auth user was still deleted or attempted (saw: ${deletes.join(", ") || "none"})`,
    );
    ok(
      calls.filter((c) => c.url.includes("/auth/v1/admin/users?filter="))
        .length === 3,
      "all 3 fixture emails were still listed after the delete failure",
    );
  }
  {
    // A THROWN delete request (rejected fetch, not an HTTP error response)
    // for the first auth user of an email must not skip the remaining users
    // of that email, the remaining fixture emails, or the later classes.
    const calls = [];
    const usersFor = (email) => {
      if (email === FIX.invitedAdmin) {
        return [
          { id: "u-a1", email },
          { id: "u-a2", email },
        ];
      }
      if (email === FIX.invitedMember) return [{ id: "u-m1", email }];
      return [];
    };
    const base = cleanStackStub([]);
    const err = await withStubbedFetch(
      async (input, init = {}) => {
        record(calls, input, init);
        const u = new URL(String(input));
        const method = init.method ?? "GET";
        if (u.pathname === "/auth/v1/admin/users" && method === "GET") {
          return jsonResponse(
            JSON.stringify({ users: usersFor(u.searchParams.get("filter")) }),
          );
        }
        if (u.pathname === "/auth/v1/admin/users/u-a1" && method === "DELETE") {
          throw new TypeError("fetch failed: connection reset");
        }
        if (
          u.pathname.startsWith("/auth/v1/admin/users/") &&
          method === "DELETE"
        ) {
          return jsonResponse("{}");
        }
        return base(input, init);
      },
      () => rejection(harness.cleanup()),
    );
    ok(err !== null, "cleanup() rejects when one auth-user delete throws");
    ok(
      err !== null &&
        /u-a1/.test(err.message) &&
        /connection reset/i.test(err.message),
      "the thrown deletion error is retained, naming the user and the cause",
    );
    const deletes = calls
      .filter(
        (c) => c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/"),
      )
      .map((c) => c.url.split("/").pop());
    ok(
      deletes.join(",") === "u-a1,u-a2,u-m1",
      `the thrown u-a1 delete did not skip u-a2 (same email) or u-m1 (later email) (saw: ${deletes.join(", ") || "none"})`,
    );
    const listedEmails = calls
      .filter((c) => c.url.includes("/auth/v1/admin/users?filter="))
      .map((c) => decodeURIComponent(c.url.split("filter=")[1]));
    ok(
      listedEmails.join(",") ===
        `${FIX.invitedAdmin},${FIX.invitedMember},${FIX.uninvited}`,
      `all 3 fixture emails were still listed after the thrown deletion (saw: ${listedEmails.join(", ") || "none"})`,
    );
    ok(
      calls.some(
        (c) => c.method === "DELETE" && c.url.includes("/rest/v1/juntos?"),
      ) &&
        calls.some(
          (c) => c.method === "DELETE" && c.url.includes("/api/v1/messages"),
        ),
      "the junto delete and Mailpit clear were still attempted after the thrown deletion",
    );
  }
  {
    const calls = [];
    const err = await withStubbedFetch(cleanStackStub(calls), () =>
      rejection(harness.cleanup()),
    );
    ok(err === null, "cleanup() succeeds against a healthy clean stack");
  }

  // ── 7. Absence verification is independent and fails closed ────────────
  console.log("\nFixture-absence verification fails closed:");
  {
    // Residual fixtures after cleanup must be reported as a teardown failure.
    const calls = [];
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/rest/v1/junto_members?",
          method: "GET",
          respond: () => jsonResponse('[{"user_id":"residue"}]'),
        },
      ]),
      () => rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err !== null,
      "verifyFixturesAbsent() rejects when fixtures remain after cleanup",
    );
    ok(
      err !== null && /junto_members/.test(err.message),
      "residual-fixture failure names the surviving table",
    );
  }
  {
    const calls = [];
    const err = await withStubbedFetch(cleanStackStub(calls), () =>
      rejection(harness.verifyFixturesAbsent()),
    );
    ok(
      err === null,
      "valid empty PostgREST, Auth, and Mailpit collections prove absence",
    );
  }

  // ── 8. In-process main(): healthy exact trace, preparation failure, and
  //       teardown failure ─────────────────────────────────────────────────
  console.log(
    "\nFull in-process main() run against a simulated healthy stack:",
  );
  {
    const calls = [];
    const mod = await importHarness("main-healthy");
    const outcome = await withStubbedFetch(
      simulatedHealthyStack(FIX, calls),
      () => withMutedConsole(() => mod.main()),
    );
    ok(
      outcome.functionalError === null,
      `healthy simulated stack yields no functional error${
        outcome.functionalError
          ? ` (got: ${outcome.functionalError.message})`
          : ""
      }`,
    );
    ok(
      outcome.teardownError === null,
      `healthy simulated stack yields no teardown error${
        outcome.teardownError ? ` (got: ${outcome.teardownError.message})` : ""
      }`,
    );
    ok(
      outcome.checks === 19 && outcome.failures === 0,
      `all 19 functional checks pass against realistic response shapes (saw ${outcome.checks - outcome.failures}/${outcome.checks})`,
    );
    const expected = expectedHealthyTrace(FIX);
    ok(
      calls.length === expected.length,
      `main() issued exactly ${expected.length} requests (saw ${calls.length})`,
    );
    const firstMismatch = expected.findIndex(
      (e, i) =>
        !calls[i] ||
        calls[i].method !== e.method ||
        calls[i].url !== e.url ||
        calls[i].redirect !== "error",
    );
    ok(
      calls.length === expected.length && firstMismatch === -1,
      firstMismatch === -1 && calls.length === expected.length
        ? 'every request matches the expected trace in order — method, exact URL, and redirect:"error"'
        : `every request matches the expected trace in order — method, exact URL, and redirect:"error" (mismatch at ${firstMismatch}: expected ${expected[firstMismatch]?.method} ${expected[firstMismatch]?.url}, saw ${
            calls[firstMismatch]
              ? `${calls[firstMismatch].method} ${calls[firstMismatch].url} redirect=${calls[firstMismatch].redirect}`
              : "nothing"
          })`,
    );
  }

  console.log(
    "\nmain() fails before seeding when stale-fixture preparation fails:",
  );
  {
    const calls = [];
    const mod = await importHarness("main-prep-failure");
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: "/rest/v1/junto_members",
          method: "DELETE",
          respond: () => jsonResponse('{"message":"boom"}', 500),
        },
      ]),
      () => withMutedConsole(() => rejection(mod.main())),
    );
    ok(
      err !== null && /refusing to seed new fixtures/i.test(err.message),
      "main() rejects before seeding, refusing to seed on a failed preparation",
    );
    ok(
      err !== null && /500/.test(err.message),
      "the preparation refusal surfaces the underlying cleanup failure",
    );
    ok(
      calls.filter((c) => c.method === "POST").length === 0,
      `zero seed POSTs occurred (saw ${calls.filter((c) => c.method === "POST").length})`,
    );
    ok(
      calls.length === 7,
      `all 7 preparation cleanup operations were still attempted before the refusal (saw ${calls.length})`,
    );
  }
  {
    const calls = [];
    const mod = await importHarness("main-prep-nested-auth-failure");
    const err = await withStubbedFetch(
      overlayStub(calls, [
        {
          match: `filter=${encodeURIComponent(FIX.invitedAdmin)}`,
          respond: () =>
            jsonResponse(
              JSON.stringify({
                users: [{ email: nestedCanary }],
              }),
            ),
        },
      ]),
      () => withMutedConsole(() => rejection(mod.main())),
    );
    ok(
      err !== null &&
        /refusing to seed new fixtures/i.test(err.message) &&
        /users\[0\]\.id/i.test(err.message) &&
        !err.message.includes(nestedCanary),
      "main() rejects a nested malformed Auth success during stale-fixture preparation",
    );
    ok(
      calls.filter((c) => c.method === "POST").length === 0 &&
        calls.length === 7 &&
        calls.at(-1)?.url.endsWith("/api/v1/messages"),
      "nested malformed preparation runs all cleanup phases and seeds nothing",
    );
  }

  console.log(
    "\nmain() preserves a malformed-detail failure while completing teardown:",
  );
  {
    const calls = [];
    const mod = await importHarness("main-detail-failure");
    const healthy = simulatedHealthyStack(FIX, calls);
    const outcome = await withStubbedFetch(
      async (input, init = {}) => {
        const url = new URL(String(input));
        if (
          url.pathname === "/api/v1/message/m1" &&
          (init.method ?? "GET") === "GET"
        ) {
          record(calls, input, init);
          return jsonResponse(
            JSON.stringify({ Text: nestedCanary, HTML: null }),
          );
        }
        return healthy(input, init);
      },
      () => withMutedConsole(() => mod.main()),
    );
    ok(
      outcome.functionalError !== null &&
        /malformed response body/i.test(outcome.functionalError.message) &&
        /HTML/i.test(outcome.functionalError.message) &&
        !outcome.functionalError.message.includes(nestedCanary),
      "main() retains the fixed schema-only malformed Mailpit detail failure",
    );
    ok(
      outcome.teardownError === null,
      "main() cleanup and independent absence verification both complete after malformed detail",
    );
    const detailIndex = calls.findIndex((c) =>
      c.url.endsWith("/api/v1/message/m1"),
    );
    const cleanupIndex = calls.findIndex(
      (c, index) =>
        index > detailIndex &&
        c.method === "DELETE" &&
        c.url.includes("/rest/v1/junto_members?"),
    );
    const absenceIndex = calls.findIndex(
      (c, index) =>
        index > cleanupIndex &&
        c.method === "GET" &&
        c.url.includes("/rest/v1/junto_members?") &&
        c.url.includes("select=user_id"),
    );
    ok(
      detailIndex !== -1 &&
        cleanupIndex > detailIndex &&
        absenceIndex > cleanupIndex &&
        calls.at(-1)?.url.endsWith("/api/v1/messages"),
      "every final cleanup and absence phase runs in order after malformed detail",
    );
    ok(
      mod.exitCodeFor(outcome) === 1,
      "malformed detail remains a nonzero run result after clean teardown",
    );
  }

  console.log(
    "\nmain() retains functional, cleanup, and verification failures together:",
  );
  {
    const calls = [];
    const mod = await importHarness("main-teardown-failure");
    const outcome = await withStubbedFetch(
      teardownFailureStub(FIX, calls),
      () => withMutedConsole(() => mod.main()),
    );
    ok(
      outcome.functionalError !== null &&
        /malformed/i.test(outcome.functionalError.message),
      "the original functional failure (malformed admin listing) is retained",
    );
    ok(
      outcome.teardownError !== null &&
        /cleanup failed/i.test(outcome.teardownError.message),
      "the cleanup failure is retained alongside the functional failure",
    );
    ok(
      outcome.teardownError !== null &&
        /fixtures remain after cleanup/i.test(outcome.teardownError.message),
      "absence verification ran after the cleanup failure and reported residues",
    );
    const failedDeleteIdx = calls.findIndex(
      (c, i) =>
        c.method === "DELETE" &&
        c.url.includes("/rest/v1/junto_members") &&
        i >
          calls.findIndex(
            (x) => x.method === "POST" && x.url.includes("/rest/v1/juntos"),
          ),
    );
    const verifyGetIdx = calls.findIndex(
      (c) =>
        c.method === "GET" &&
        c.url.includes("/rest/v1/junto_members") &&
        c.url.includes("select="),
    );
    ok(
      failedDeleteIdx !== -1 && verifyGetIdx > failedDeleteIdx,
      `the verification query ran after the failed cleanup delete (delete at ${failedDeleteIdx}, verify at ${verifyGetIdx})`,
    );
    ok(
      mod.exitCodeFor(outcome) === 1,
      "the combined functional + teardown failure produces a nonzero exit",
    );
  }

  // ── 9. Exit semantics ──────────────────────────────────────────────────
  console.log("\nExit code semantics fail closed:");
  const { exitCodeFor } = harness;
  ok(typeof exitCodeFor === "function", "harness exports exitCodeFor");
  ok(
    exitCodeFor?.({ functionalError: null, teardownError: null }) === 0,
    "clean run with clean teardown exits 0",
  );
  ok(
    exitCodeFor?.({
      functionalError: new Error("assertion failed"),
      teardownError: null,
    }) === 1,
    "functional failure exits 1",
  );
  ok(
    exitCodeFor?.({
      functionalError: null,
      teardownError: new Error("delete failed"),
    }) === 1,
    "teardown failure alone exits 1 even when all assertions passed",
  );
  ok(
    exitCodeFor?.({
      functionalError: new Error("assertion failed"),
      teardownError: new Error("delete failed"),
    }) === 1,
    "combined functional and teardown failure exits 1",
  );

  console.log(
    `\n${checks - failures}/${checks} safety checks passed; ${failures} failed.`,
  );
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nSafety self-check harness error:", err);
  process.exit(1);
});
