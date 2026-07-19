import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { connect, createServer } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import {
  processGroupExists,
  terminateProcessGroup,
} from "../../scripts/process-group.mjs";

let ownedProcessGroupId: number | null = null;
let ownedDescendantPid: number | null = null;
let ownedPort: number | null = null;

function portAcceptsConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function reserveLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test listener did not receive an explicit TCP port");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function pidIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    const state = readFileSync(`/proc/${pid}/stat`, "utf8").split(" ")[2];
    return state !== "Z";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

async function waitForChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await once(child, "exit");
}

afterEach(async () => {
  if (ownedProcessGroupId && processGroupExists(ownedProcessGroupId)) {
    process.kill(-ownedProcessGroupId, "SIGKILL");
  }
  if (ownedDescendantPid && pidIsRunning(ownedDescendantPid)) {
    process.kill(ownedDescendantPid, "SIGKILL");
  }
  if (ownedPort && (await portAcceptsConnections(ownedPort))) {
    throw new Error("process-group regression cleanup left its listener alive");
  }
  ownedProcessGroupId = null;
  ownedDescendantPid = null;
  ownedPort = null;
});

describe("production process-group teardown", () => {
  it("kills a TERM-resistant listening descendant after its wrapper exits", async () => {
    ownedPort = await reserveLoopbackPort();
    const listenerProgram = [
      'const { createServer } = require("node:net");',
      'process.on("SIGTERM", () => undefined);',
      `createServer().listen(${ownedPort}, "127.0.0.1", () => process.send("ready"));`,
    ].join("");
    const wrapperProgram = [
      'const { spawn } = require("node:child_process");',
      `const descendant = spawn(process.execPath, ["-e", ${JSON.stringify(listenerProgram)}], `,
      '{ stdio: ["ignore", "ignore", "ignore", "ipc"] });',
      'descendant.once("message", () => {',
      "  process.stdout.write(`${descendant.pid}\\n`);",
      "  process.exit(0);",
      "});",
    ].join("");
    const wrapper = spawn(process.execPath, ["-e", wrapperProgram], {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (!wrapper.pid || !wrapper.stdout) {
      throw new Error("test wrapper process group was not created");
    }
    ownedProcessGroupId = wrapper.pid;

    const [pidOutput] = (await once(wrapper.stdout, "data")) as [Buffer];
    ownedDescendantPid = Number(pidOutput.toString("utf8").trim());
    await waitForChildExit(wrapper);

    expect(wrapper.exitCode).toBe(0);
    expect(pidIsRunning(ownedDescendantPid)).toBe(true);
    expect(await portAcceptsConnections(ownedPort)).toBe(true);

    await terminateProcessGroup(ownedProcessGroupId, {
      termTimeoutMs: 100,
      killTimeoutMs: 2_000,
      pollIntervalMs: 10,
    });

    expect(processGroupExists(ownedProcessGroupId)).toBe(false);
    expect(pidIsRunning(ownedDescendantPid)).toBe(false);
    expect(await portAcceptsConnections(ownedPort)).toBe(false);
  });
});
