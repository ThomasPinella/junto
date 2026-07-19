import { MAILPIT_URL, SUPABASE_URL } from "./fixtures";
import { assertLoopbackTarget, guardedRequest } from "./loopback";

// The live journeys need the local Supabase stack (GoTrue, PostgREST,
// Mailpit) to be running: `pnpm db:start` first. This is an explicit,
// documented requirement of `pnpm test:e2e:live` (see README); the baseline
// `pnpm test:e2e` never touches the stack. Fail fast with a clear message
// rather than timing out inside the journeys.
export default async function globalSetup(): Promise<void> {
  assertLoopbackTarget("SUPABASE_URL", SUPABASE_URL);
  assertLoopbackTarget("MAILPIT_URL", MAILPIT_URL);
  const probe = async (name: string, url: string) => {
    try {
      const res = await guardedRequest(name, url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      throw new Error(
        `${name} (${url}) is not reachable — start the local Supabase stack ` +
          `with \`pnpm db:start\` before running \`pnpm test:e2e:live\`. ` +
          `(${err instanceof Error ? err.message : err})`,
      );
    }
  };
  await probe("SUPABASE_URL", `${SUPABASE_URL}/auth/v1/health`);
  await probe("MAILPIT_URL", `${MAILPIT_URL}/api/v1/messages`);
}
