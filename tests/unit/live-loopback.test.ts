import { describe, expect, it } from "vitest";

import { assertLoopbackTarget } from "../../e2e/live/loopback";

// The live-journey fixture harness performs service-role mutations; its
// transport must refuse every non-loopback target before any request.
describe("assertLoopbackTarget (live e2e fixture harness)", () => {
  it("accepts literal loopback hosts", () => {
    expect(() =>
      assertLoopbackTarget("SUPABASE_URL", "http://127.0.0.1:54321"),
    ).not.toThrow();
    expect(() =>
      assertLoopbackTarget("SUPABASE_URL", "http://localhost:54321"),
    ).not.toThrow();
    expect(() =>
      assertLoopbackTarget("SUPABASE_URL", "http://[::1]:54321"),
    ).not.toThrow();
    expect(() =>
      assertLoopbackTarget("SUPABASE_URL", "http://127.9.8.7:54321"),
    ).not.toThrow();
  });

  it("refuses remote and non-loopback targets", () => {
    for (const value of [
      "https://example.supabase.co",
      "http://10.0.0.5:54321",
      "http://192.168.1.10:54321",
      "http://evil.example",
      "http://localhost.example.com:54321",
      "http://[::2]:54321",
      "http://128.0.0.1:54321",
    ]) {
      expect(() => assertLoopbackTarget("SUPABASE_URL", value)).toThrow(
        /not a loopback address/,
      );
    }
  });

  it("refuses unparseable URLs and unsupported schemes", () => {
    expect(() => assertLoopbackTarget("SUPABASE_URL", "not a url")).toThrow(
      /not a parseable URL/,
    );
    expect(() =>
      assertLoopbackTarget("SUPABASE_URL", "file:///etc/passwd"),
    ).toThrow(/unsupported scheme/);
    expect(() =>
      assertLoopbackTarget("SUPABASE_URL", "ftp://127.0.0.1"),
    ).toThrow(/unsupported scheme/);
  });

  it("never echoes the refused value", () => {
    try {
      assertLoopbackTarget("SUPABASE_URL", "https://secret-host.example/key");
      expect.unreachable("expected a refusal");
    } catch (err) {
      expect(String(err)).not.toContain("secret-host.example/key");
    }
  });
});
