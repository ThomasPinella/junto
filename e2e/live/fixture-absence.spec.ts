import { test } from "@playwright/test";

import { verifyFixturesAbsent } from "./fixtures";

test("explicit post-run fixture absence", async () => {
  await verifyFixturesAbsent();
});
