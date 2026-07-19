export interface ProcessGroupTerminationOptions {
  termTimeoutMs?: number;
  killTimeoutMs?: number;
  pollIntervalMs?: number;
}

export function processGroupExists(processGroupId: number): boolean;

export function terminateProcessGroup(
  processGroupId: number,
  options?: ProcessGroupTerminationOptions,
): Promise<void>;
