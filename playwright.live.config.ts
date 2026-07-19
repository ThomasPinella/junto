import { defineConfig, devices } from "@playwright/test";

const PORT = 3211;
const baseURL = `http://127.0.0.1:${PORT}`;

// Live T03 journeys against the real local Supabase stack (GoTrue,
// PostgREST, Mailpit). Explicit integration command: `pnpm test:e2e:live`
// requires `pnpm db:start` first (checked fast in global-setup); the
// baseline `pnpm test:e2e` stays stack-free. The app is served as a
// production build on its own port with the matching configured site URL so
// Auth callback redirects never depend on request Host headers. Fixture
// state is shared within the serial journey, so a single worker runs the
// desktop and mobile projects one after the other, each re-seeding from
// clean state.
export default defineConfig({
  testDir: "./e2e/live",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Journeys are stateful and ordered; a retry mid-journey would run against
  // mutated fixtures, so failures surface immediately instead.
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/live/global-setup.ts",
  use: {
    baseURL,
    // No traces: trace archives would retain auth cookies and emailed
    // sign-in links from the live flows.
    trace: "off",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // The configured site URL must match where this server actually
      // listens; Auth email links redirect back through it.
      NEXT_PUBLIC_SITE_URL: baseURL,
      // The live public archive serves the T04 public fixture chapter, so
      // the `/meetings` journeys exercise the real safe projection. The T03
      // portal fixtures stay private and separate.
      JUNTO_INITIAL_JUNTO_SLUG: "t04-poplar",
    },
  },
});
