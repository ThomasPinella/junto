import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MEMBER_EMAIL,
  UNINVITED_EMAIL,
  adminUsersByEmail,
  cleanupFixtures,
  latestAuthLinkFor,
  verifyFixturesAbsent,
} from "../../e2e/live/fixtures";

// The live fixture harness performs service-role cleanup and independent
// absence verification. A malformed HTTP 200 — nested elements included —
// must fail closed rather than read as "no users" / "no messages" /
// "unrelated mail": these network-free proofs stub global fetch and feed the
// harness structurally broken successful responses.

const VALID_USER_ID = "6f0e8c2a-1b3d-4c5e-8f7a-9b0c1d2e3f40";
const OTHER_EMAIL = "someone-else@example.com";
// Prefix of the well-known local demo service-role JWT; no diagnostic may
// ever carry credential material, so refusals are checked against it.
const DEMO_JWT_PREFIX = "eyJhbGciOiJIUzI1NiI";

interface StubResponse {
  status: number;
  body: unknown;
}

interface ObservedCall {
  method: string;
  url: URL;
  redirect: unknown;
}

interface RouteSpec {
  authListing?: (filter: string) => StubResponse | undefined;
  mailpitList?: StubResponse;
  mailpitDetail?: (id: string) => StubResponse | undefined;
  restRows?: unknown;
  allowDeletes?: boolean;
}

// Routes only the exact method/path combinations a test expects; anything
// else rejects, so a passing proof cannot hide an unobserved request shape.
function route(spec: RouteSpec, method: string, url: URL): StubResponse {
  const path = url.pathname;
  const unexpected = () => {
    throw new Error(`unexpected request in stub: ${method} ${path}`);
  };
  if (path.startsWith("/api/v1/")) {
    if (path === "/api/v1/messages" && method === "GET") {
      return spec.mailpitList ?? unexpected();
    }
    if (path === "/api/v1/messages" && method === "DELETE") {
      return spec.allowDeletes ? { status: 200, body: null } : unexpected();
    }
    const detail = /^\/api\/v1\/message\/([^/]+)$/.exec(path);
    if (detail?.[1] && method === "GET") {
      return (
        spec.mailpitDetail?.(decodeURIComponent(detail[1])) ?? unexpected()
      );
    }
    return unexpected();
  }
  if (path === "/auth/v1/admin/users" && method === "GET") {
    const filter = url.searchParams.get("filter") ?? "";
    return spec.authListing?.(filter) ?? unexpected();
  }
  if (/^\/auth\/v1\/admin\/users\/[^/]+$/.test(path) && method === "DELETE") {
    return spec.allowDeletes ? { status: 200, body: null } : unexpected();
  }
  if (/^\/rest\/v1\/(junto_members|junto_invitations|juntos)$/.test(path)) {
    if (method === "GET") return { status: 200, body: spec.restRows ?? [] };
    if (method === "DELETE" && spec.allowDeletes) {
      return { status: 204, body: undefined };
    }
  }
  return unexpected();
}

function installFetchStub(spec: RouteSpec): ObservedCall[] {
  const calls: ObservedCall[] = [];
  const stub = async (
    input: string | URL,
    init?: { method?: string; redirect?: string },
  ): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, url, redirect: init?.redirect });
    // The guarded transport's own contract, re-enforced at the stub: every
    // observed request must target loopback and refuse redirects.
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      throw new Error(`stub observed non-loopback host "${url.hostname}"`);
    }
    if (init?.redirect !== "error") {
      throw new Error('stub observed a request without redirect:"error"');
    }
    const handled = route(spec, method, url);
    const text = handled.body === undefined ? "" : JSON.stringify(handled.body);
    return {
      ok: handled.status < 300,
      status: handled.status,
      text: async () => text,
      json: async () => JSON.parse(text) as unknown,
    } as unknown as Response;
  };
  vi.stubGlobal("fetch", stub);
  return calls;
}

const emptyAuthListing = () => ({ status: 200, body: { users: [] } });
const emptyMailpitList = { status: 200, body: { messages: [] } };

function expectCredentialFree(err: unknown): void {
  const text = String(err instanceof Error ? err.message : err);
  expect(text).not.toContain(DEMO_JWT_PREFIX);
  expect(text).not.toContain("Bearer");
  expect(text).not.toContain("Authorization");
  expect(text).not.toContain("apikey");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adminUsersByEmail (nested successful-response schema)", () => {
  it("rejects a malformed 200 with an empty user object", async () => {
    installFetchStub({
      authListing: () => ({ status: 200, body: { users: [{}] } }),
    });
    await expect(adminUsersByEmail(MEMBER_EMAIL)).rejects.toThrow(
      /malformed response body/,
    );
  });

  it("rejects malformed nested id/email variants instead of filtering to absence", async () => {
    const malformedListings: unknown[] = [
      { users: [null] },
      { users: ["not-an-object"] },
      { users: [{ id: 123, email: MEMBER_EMAIL }] },
      { users: [{ id: "not-a-uuid", email: MEMBER_EMAIL }] },
      { users: [{ id: "", email: MEMBER_EMAIL }] },
      { users: [{ id: VALID_USER_ID, email: 42 }] },
      { users: [{ id: VALID_USER_ID, email: "" }] },
      { users: [{ id: VALID_USER_ID }] },
      { users: [{ email: MEMBER_EMAIL }] },
      // One malformed element poisons the listing even beside a valid one.
      {
        users: [
          { id: VALID_USER_ID, email: OTHER_EMAIL },
          { id: VALID_USER_ID.replace("6f", "7f") },
        ],
      },
    ];
    for (const body of malformedListings) {
      installFetchStub({ authListing: () => ({ status: 200, body }) });
      await expect(
        adminUsersByEmail(MEMBER_EMAIL),
        `listing ${JSON.stringify(body)} must reject`,
      ).rejects.toThrow(/malformed response body/);
    }
  });

  it("still reads a valid empty or non-matching listing as absence", async () => {
    installFetchStub({ authListing: emptyAuthListing });
    await expect(adminUsersByEmail(MEMBER_EMAIL)).resolves.toEqual([]);

    installFetchStub({
      authListing: () => ({
        status: 200,
        body: { users: [{ id: VALID_USER_ID, email: OTHER_EMAIL }] },
      }),
    });
    await expect(adminUsersByEmail(MEMBER_EMAIL)).resolves.toEqual([]);
  });

  it("returns exact-email matches from a valid listing", async () => {
    installFetchStub({
      authListing: () => ({
        status: 200,
        body: {
          users: [
            { id: VALID_USER_ID, email: MEMBER_EMAIL },
            { id: VALID_USER_ID.replace("6f", "7f"), email: OTHER_EMAIL },
          ],
        },
      }),
    });
    await expect(adminUsersByEmail(MEMBER_EMAIL)).resolves.toEqual([
      { id: VALID_USER_ID, email: MEMBER_EMAIL },
    ]);
  });

  it("refuses with credential-free diagnostics over a guarded transport", async () => {
    const calls = installFetchStub({
      authListing: () => ({ status: 200, body: { users: [{}] } }),
    });
    let caught: unknown = null;
    try {
      await adminUsersByEmail(MEMBER_EMAIL);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expectCredentialFree(caught);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.hostname).toBe("127.0.0.1");
    expect(calls[0]?.redirect).toBe("error");
  });
});

describe("Mailpit listing (nested successful-response schema)", () => {
  it("rejects a malformed 200 with an empty message object", async () => {
    installFetchStub({
      mailpitList: { status: 200, body: { messages: [{}] } },
    });
    await expect(
      latestAuthLinkFor(MEMBER_EMAIL, { attempts: 1, delayMs: 1 }),
    ).rejects.toThrow(/malformed response body/);
  });

  it("rejects malformed recipients instead of counting them as unrelated mail", async () => {
    const malformedListings: unknown[] = [
      { messages: [null] },
      { messages: [{ ID: "", To: [] }] },
      { messages: [{ ID: 7, To: [] }] },
      { messages: [{ To: [{ Address: MEMBER_EMAIL }] }] },
      { messages: [{ ID: "m1" }] },
      { messages: [{ ID: "m1", To: "not-a-list" }] },
      { messages: [{ ID: "m1", To: [null] }] },
      { messages: [{ ID: "m1", To: [{ Address: 42 }] }] },
      { messages: [{ ID: "m1", To: [{ Address: "" }] }] },
      { messages: [{ ID: "m1", To: [{}] }] },
      // A valid sibling does not excuse a malformed element.
      {
        messages: [
          { ID: "m1", To: [{ Address: OTHER_EMAIL }] },
          { ID: "m2", To: [{ Address: 42 }] },
        ],
      },
    ];
    for (const body of malformedListings) {
      installFetchStub({ mailpitList: { status: 200, body } });
      await expect(
        latestAuthLinkFor(MEMBER_EMAIL, { attempts: 1, delayMs: 1 }),
        `listing ${JSON.stringify(body)} must reject`,
      ).rejects.toThrow(/malformed response body/);
    }
  });

  it("still treats a valid empty listing as no mail yet", async () => {
    installFetchStub({ mailpitList: emptyMailpitList });
    await expect(
      latestAuthLinkFor(MEMBER_EMAIL, { attempts: 2, delayMs: 1 }),
    ).rejects.toThrow(/No verification email/);
  });
});

describe("Mailpit message detail (successful-response schema)", () => {
  const listWithFixtureMail = {
    status: 200,
    body: { messages: [{ ID: "detail-1", To: [{ Address: MEMBER_EMAIL }] }] },
  };

  it("rejects a malformed detail 200 immediately instead of polling to 'no link arrived'", async () => {
    const malformedDetails: unknown[] = [
      null,
      [],
      "just text",
      { Text: 123, HTML: "<p>x</p>" },
      { Text: "body", HTML: 123 },
      { Text: "body" },
      { HTML: "<p>x</p>" },
    ];
    for (const body of malformedDetails) {
      const calls = installFetchStub({
        mailpitList: listWithFixtureMail,
        mailpitDetail: () => ({ status: 200, body }),
      });
      let caught: unknown = null;
      try {
        await latestAuthLinkFor(MEMBER_EMAIL, { attempts: 5, delayMs: 1 });
      } catch (err) {
        caught = err;
      }
      expect(
        caught,
        `detail ${JSON.stringify(body)} must reject`,
      ).toBeInstanceOf(Error);
      const message = String((caught as Error).message);
      expect(message).toMatch(/malformed response body/);
      // Fail closed at once: no silent conversion into further polling.
      expect(message).not.toMatch(/No verification email/);
      const listings = calls.filter(
        (c) => c.url.pathname === "/api/v1/messages",
      );
      expect(listings).toHaveLength(1);
      expectCredentialFree(caught);
      vi.unstubAllGlobals();
    }
  });

  it("extracts the real verification link from a valid detail", async () => {
    installFetchStub({
      mailpitList: listWithFixtureMail,
      mailpitDetail: (id) =>
        id === "detail-1"
          ? {
              status: 200,
              body: {
                Text: "",
                HTML: '<a href="http://127.0.0.1:54321/auth/v1/verify?token=tkn&amp;type=magiclink">Sign in</a>',
              },
            }
          : undefined,
    });
    await expect(
      latestAuthLinkFor(MEMBER_EMAIL, { attempts: 1, delayMs: 1 }),
    ).resolves.toBe(
      "http://127.0.0.1:54321/auth/v1/verify?token=tkn&type=magiclink",
    );
  });
});

describe("verifyFixturesAbsent (independent absence verification)", () => {
  it("resolves when every listing is valid and empty or unrelated", async () => {
    installFetchStub({
      authListing: emptyAuthListing,
      mailpitList: {
        status: 200,
        body: { messages: [{ ID: "m9", To: [{ Address: OTHER_EMAIL }] }] },
      },
    });
    await expect(verifyFixturesAbsent()).resolves.toBeUndefined();
  });

  it("rejects when the Auth listing is malformed even though everything else is empty", async () => {
    installFetchStub({
      authListing: (filter) =>
        filter === MEMBER_EMAIL
          ? { status: 200, body: { users: [{}] } }
          : emptyAuthListing(),
      mailpitList: emptyMailpitList,
    });
    let caught: unknown = null;
    try {
      await verifyFixturesAbsent();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(String((caught as Error).message)).toMatch(
      /malformed response body/,
    );
    expectCredentialFree(caught);
  });

  it("rejects when the Mailpit listing is malformed even though everything else is empty", async () => {
    installFetchStub({
      authListing: emptyAuthListing,
      mailpitList: {
        status: 200,
        body: { messages: [{ ID: "m1", To: [{ Address: 42 }] }] },
      },
    });
    let caught: unknown = null;
    try {
      await verifyFixturesAbsent();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(String((caught as Error).message)).toMatch(
      /malformed response body/,
    );
    expectCredentialFree(caught);
  });
});

describe("cleanupFixtures (shared listing helper fails closed)", () => {
  it("fails cleanup when the Auth listing is malformed, while still attempting the remaining classes", async () => {
    const calls = installFetchStub({
      allowDeletes: true,
      authListing: (filter) =>
        filter === UNINVITED_EMAIL
          ? { status: 200, body: { users: [{ id: "nope" }] } }
          : emptyAuthListing(),
      mailpitList: emptyMailpitList,
    });
    let caught: unknown = null;
    try {
      await cleanupFixtures();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = String((caught as Error).message);
    expect(message).toMatch(/cleanup failed/);
    expect(message).toMatch(/malformed response body/);
    expectCredentialFree(caught);
    // The malformed listing must not short-circuit later fixture classes:
    // juntos deletion and the Mailpit clear still ran.
    const observed = calls.map((c) => `${c.method} ${c.url.pathname}`);
    expect(observed).toContain("DELETE /rest/v1/juntos");
    expect(observed).toContain("DELETE /api/v1/messages");
  });
});
