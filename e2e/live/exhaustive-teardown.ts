export interface LiveTeardownPhases {
  closeBrowserContext: () => Promise<void>;
  cleanupFixtures: () => Promise<void>;
  verifyFixturesAbsent: () => Promise<void>;
}

interface ClosableBrowserContext {
  close: () => Promise<void>;
}

export async function closeBrowserContextsExhaustively(
  contexts: readonly ClosableBrowserContext[],
): Promise<void> {
  const results = await Promise.allSettled(
    contexts.map((context) => context.close()),
  );
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Browser context close failed");
  }
}

// Teardown is closed-world evidence, not best effort. Every independent
// phase runs even after an earlier failure, while fixed diagnostics ensure a
// thrown browser or transport error cannot disclose cookies or credentials.
export async function runExhaustiveLiveTeardown(
  phases: LiveTeardownPhases,
): Promise<void> {
  const failures: string[] = [];
  const run = async (name: string, phase: () => Promise<void>) => {
    try {
      await phase();
    } catch {
      failures.push(name);
    }
  };

  await run("browser context close", phases.closeBrowserContext);
  await run("fixture cleanup", phases.cleanupFixtures);
  await run("independent absence verification", phases.verifyFixturesAbsent);

  if (failures.length > 0) {
    throw new Error(`Live teardown failed (${failures.join(", ")})`);
  }
}
