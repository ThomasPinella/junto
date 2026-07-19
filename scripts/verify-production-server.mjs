import { spawn } from "node:child_process";
import { connect } from "node:net";

import { terminateProcessGroup } from "./process-group.mjs";

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("PORT must be an explicit unused non-privileged TCP port");
}

function portAcceptsConnections() {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

if (await portAcceptsConnections()) {
  throw new Error(`Refusing to use PORT ${port}: a listener already exists`);
}

const child = spawn("pnpm", ["start"], {
  detached: true,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});
if (!child.pid) {
  throw new Error("production server process group could not be determined");
}
const processGroupId = child.pid;
let output = "";
child.stdout.on("data", (chunk) => {
  output += String(chunk);
});
child.stderr.on("data", (chunk) => {
  output += String(chunk);
});

try {
  const origin = `http://127.0.0.1:${port}`;
  let health;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`production server exited early (${child.exitCode})`);
    }
    try {
      health = await fetch(`${origin}/health`, { redirect: "error" });
      if (health.status === 200) break;
    } catch {
      // The process is still starting; retry within the fixed 40s window.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!health || health.status !== 200) {
    throw new Error("health endpoint did not become ready within 40 seconds");
  }
  const healthBody = await health.json();
  if (healthBody?.status !== "ready") {
    throw new Error("health endpoint returned an unexpected body");
  }
  const quiet = await fetch(`${origin}/about`, { redirect: "error" });
  if (quiet.status !== 200) {
    throw new Error(`quiet public route returned HTTP ${quiet.status}`);
  }
  process.stdout.write(
    `production proof passed: /health 200 ready; /about 200; PORT ${port}\n`,
  );
} catch (error) {
  const safeOutput = output
    .split("\n")
    .filter((line) => !/key|token|secret|credential/i.test(line))
    .slice(-20)
    .join("\n");
  throw new Error(
    `${error instanceof Error ? error.message : error}\n${safeOutput}`,
  );
} finally {
  await terminateProcessGroup(processGroupId);
  if (await portAcceptsConnections()) {
    throw new Error(`production proof leaked a listener on PORT ${port}`);
  }
}
