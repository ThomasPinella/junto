import { describe, expect, it, vi } from "vitest";

import {
  closeBrowserContextsExhaustively,
  runExhaustiveLiveTeardown,
} from "../../e2e/live/exhaustive-teardown";

describe("browser context aggregation", () => {
  it("waits for every close attempt before reporting a fixed aggregate failure", async () => {
    let releaseSecondClose: (() => void) | undefined;
    let aggregateSettled = false;
    const secondClose = new Promise<void>((resolve) => {
      releaseSecondClose = resolve;
    });

    const close = closeBrowserContextsExhaustively([
      { close: vi.fn(async () => Promise.reject(new Error("secret first"))) },
      { close: vi.fn(async () => secondClose) },
    ]);
    void close.then(
      () => {
        aggregateSettled = true;
      },
      () => {
        aggregateSettled = true;
      },
    );

    await Promise.resolve();
    expect(aggregateSettled).toBe(false);

    releaseSecondClose?.();
    await expect(close).rejects.toThrow("Browser context close failed");
    expect(aggregateSettled).toBe(true);
  });
});

describe("live workspace exhaustive teardown", () => {
  it("attempts cleanup and verification independently after every earlier failure", async () => {
    const calls: string[] = [];
    const closeBrowserContext = vi.fn(async () => {
      calls.push("close");
      throw new Error("sensitive browser detail");
    });
    const cleanupFixtures = vi.fn(async () => {
      calls.push("cleanup");
      throw new Error("sensitive cleanup detail");
    });
    const verifyFixturesAbsent = vi.fn(async () => {
      calls.push("verify");
      throw new Error("sensitive verification detail");
    });

    await expect(
      runExhaustiveLiveTeardown({
        closeBrowserContext,
        cleanupFixtures,
        verifyFixturesAbsent,
      }),
    ).rejects.toThrow(
      "Live teardown failed (browser context close, fixture cleanup, independent absence verification)",
    );

    expect(calls).toEqual(["close", "cleanup", "verify"]);
    expect(closeBrowserContext).toHaveBeenCalledOnce();
    expect(cleanupFixtures).toHaveBeenCalledOnce();
    expect(verifyFixturesAbsent).toHaveBeenCalledOnce();
  });

  it("completes quietly when every phase succeeds", async () => {
    await expect(
      runExhaustiveLiveTeardown({
        closeBrowserContext: vi.fn(async () => undefined),
        cleanupFixtures: vi.fn(async () => undefined),
        verifyFixturesAbsent: vi.fn(async () => undefined),
      }),
    ).resolves.toBeUndefined();
  });
});
