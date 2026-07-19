#!/usr/bin/env node
// Safety self-checks for the live GoTrue regression harness
// (verify-mailbox-ownership.mjs). The harness uses service-role credentials
// to delete and insert fixtures, so it must be impossible to point it at a
// non-loopback Supabase or Mailpit endpoint, and its teardown must fail
// closed. These checks are deterministic and never contact any network
// endpoint: remote-target proofs stub global fetch (and assert it is never
// called) or use reserved `.invalid` hostnames that the guard must reject
// before any request is attempted.
//
// Runs without the local Supabase stack.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HARNESS_URL = new URL("./verify-mailbox-ownership.mjs", import.meta.url);
const HARNESS_PATH = fileURLToPath(HARNESS_URL);

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

// Path-aware fetch stub simulating a healthy, already-clean local stack.
function cleanStackStub(calls) {
  return async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? "GET" });
    if (url.includes("/auth/v1/admin/users?")) {
      return jsonResponse('{"users":[]}');
    }
    if (url.includes("/rest/v1/")) {
      return jsonResponse(init.method === "DELETE" ? "" : "[]");
    }
    if (url.includes("/api/v1/messages")) {
      return jsonResponse(init.method === "DELETE" ? "" : '{"messages":[]}');
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

  // ── 1. Loopback guard unit behavior ────────────────────────────────────
  console.log("Loopback target guard accepts only explicit loopback hosts:");
  const harness = await importHarness("guard");
  const { assertLoopbackTarget } = harness;
  ok(
    typeof assertLoopbackTarget === "function",
    "harness exports assertLoopbackTarget",
  );

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
          async (input) => {
            calls.push(String(input));
            throw new Error("network request attempted");
          },
          async () => {
            const mod = await importHarness("remote-supabase");
            return rejection(mod.main());
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
          async (input) => {
            calls.push(String(input));
            throw new Error("network request attempted");
          },
          async () => {
            const mod = await importHarness("remote-mailpit");
            return rejection(mod.main());
          },
        ),
    );
    ok(err !== null, "main() rejects a remote MAILPIT_URL");
    ok(
      calls.length === 0,
      `no network request occurred before rejection (saw ${calls.length})`,
    );
  }

  // ── 3. Standard invocation (child process) also refuses remote targets ─
  console.log("\nStandard `node <harness>` invocation refuses remote targets:");
  {
    const { code, out } = await runHarness({
      SUPABASE_URL: "https://c04-refused.supabase.invalid",
    });
    ok(code !== 0, "exits nonzero for a remote SUPABASE_URL");
    ok(/loopback/i.test(out), "output names the loopback requirement");
    ok(
      !/fetch failed/i.test(out),
      "no fetch was attempted against the remote target",
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
      "no fetch was attempted against the remote target",
    );
  }

  // ── 4. Teardown fails closed ───────────────────────────────────────────
  console.log("\nTeardown checks every response and fails closed:");
  {
    const calls = [];
    const err = await withStubbedFetch(
      async (input, init = {}) => {
        calls.push(String(input));
        return jsonResponse('{"message":"boom"}', 500);
      },
      () => rejection(harness.cleanup()),
    );
    ok(err !== null, "cleanup() rejects when a delete returns HTTP 500");
    ok(
      err !== null && /500/.test(err.message),
      "cleanup() failure surfaces the HTTP status",
    );
    ok(calls.length > 0, "cleanup() attempted the deletions before failing");
  }
  {
    const calls = [];
    const err = await withStubbedFetch(cleanStackStub(calls), () =>
      rejection(harness.cleanup()),
    );
    ok(err === null, "cleanup() succeeds against a healthy clean stack");
  }
  {
    // Residual fixtures after cleanup must be reported as a teardown failure.
    const stub = cleanStackStub([]);
    const err = await withStubbedFetch(
      async (input, init = {}) => {
        const url = String(input);
        if (
          url.includes("/rest/v1/junto_members?") &&
          (init.method ?? "GET") === "GET"
        ) {
          return jsonResponse('[{"user_id":"residue"}]');
        }
        return stub(input, init);
      },
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
    const err = await withStubbedFetch(cleanStackStub([]), () =>
      rejection(harness.verifyFixturesAbsent()),
    );
    ok(err === null, "verifyFixturesAbsent() passes when nothing remains");
  }

  // ── 5. Exit semantics ──────────────────────────────────────────────────
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
