const DEFAULT_POLL_INTERVAL_MS = 25;

export function processGroupExists(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function signalProcessGroup(processGroupId, signal) {
  try {
    process.kill(-processGroupId, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForProcessGroupExit(
  processGroupId,
  timeoutMs,
  pollIntervalMs,
) {
  const deadline = Date.now() + timeoutMs;
  while (processGroupExists(processGroupId)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return false;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(pollIntervalMs, remainingMs)),
    );
  }
  return true;
}

export async function terminateProcessGroup(
  processGroupId,
  {
    termTimeoutMs = 5_000,
    killTimeoutMs = 5_000,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = {},
) {
  if (!Number.isInteger(processGroupId) || processGroupId <= 0) {
    throw new Error("process group id must be a positive integer");
  }

  // The group remains the cleanup boundary even after its original leader has
  // exited. A wrapper's exit must never suppress signals to its descendants.
  signalProcessGroup(processGroupId, "SIGTERM");
  if (
    await waitForProcessGroupExit(processGroupId, termTimeoutMs, pollIntervalMs)
  ) {
    return;
  }

  signalProcessGroup(processGroupId, "SIGKILL");
  if (
    !(await waitForProcessGroupExit(
      processGroupId,
      killTimeoutMs,
      pollIntervalMs,
    ))
  ) {
    throw new Error("production server process group did not terminate");
  }
}
