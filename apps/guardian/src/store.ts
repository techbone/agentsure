import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExecutionRecord, GuardianState, GuardianStateStore, TrackedPolicy } from "./types.js";

type SerializedTrackedPolicy = Omit<
  TrackedPolicy,
  "policyId" | "principalAssets" | "shares" | "triggerAssets" | "expiresAt" | "openedBlock"
> & {
  policyId: string;
  principalAssets: string;
  shares: string;
  triggerAssets: string;
  expiresAt: string;
  openedBlock: string;
};

type SerializedExecutionRecord = Omit<
  ExecutionRecord,
  "policyId" | "blockNumber" | "assetsReturned"
> & {
  policyId: string;
  blockNumber: string | null;
  assetsReturned: string | null;
};

type SerializedGuardianState = {
  schemaVersion: 1;
  lastProcessedBlock: string | null;
  policies: Record<string, SerializedTrackedPolicy>;
  executions: Record<string, SerializedExecutionRecord>;
};

export function createEmptyGuardianState(): GuardianState {
  return {
    schemaVersion: 1,
    lastProcessedBlock: null,
    policies: {},
    executions: {},
  };
}

function serializeState(state: GuardianState): SerializedGuardianState {
  return {
    schemaVersion: 1,
    lastProcessedBlock: state.lastProcessedBlock?.toString() ?? null,
    policies: Object.fromEntries(
      Object.entries(state.policies).map(([policyId, policy]) => [
        policyId,
        {
          ...policy,
          policyId: policy.policyId.toString(),
          principalAssets: policy.principalAssets.toString(),
          shares: policy.shares.toString(),
          triggerAssets: policy.triggerAssets.toString(),
          expiresAt: policy.expiresAt.toString(),
          openedBlock: policy.openedBlock.toString(),
        },
      ]),
    ),
    executions: Object.fromEntries(
      Object.entries(state.executions).map(([policyId, execution]) => [
        policyId,
        {
          ...execution,
          policyId: execution.policyId.toString(),
          blockNumber: execution.blockNumber?.toString() ?? null,
          assetsReturned: execution.assetsReturned?.toString() ?? null,
        },
      ]),
    ),
  };
}

function deserializeState(value: SerializedGuardianState): GuardianState {
  if (value.schemaVersion !== 1 || typeof value.policies !== "object") {
    throw new Error("Unsupported or corrupt guardian state");
  }

  return {
    schemaVersion: 1,
    lastProcessedBlock: value.lastProcessedBlock === null ? null : BigInt(value.lastProcessedBlock),
    policies: Object.fromEntries(
      Object.entries(value.policies).map(([policyId, policy]) => [
        policyId,
        {
          ...policy,
          policyId: BigInt(policy.policyId),
          principalAssets: BigInt(policy.principalAssets),
          shares: BigInt(policy.shares),
          triggerAssets: BigInt(policy.triggerAssets),
          expiresAt: BigInt(policy.expiresAt),
          openedBlock: BigInt(policy.openedBlock),
        },
      ]),
    ),
    executions: Object.fromEntries(
      Object.entries(value.executions).map(([policyId, execution]) => [
        policyId,
        {
          ...execution,
          policyId: BigInt(execution.policyId),
          blockNumber: execution.blockNumber === null ? null : BigInt(execution.blockNumber),
          assetsReturned:
            execution.assetsReturned === null ? null : BigInt(execution.assetsReturned),
        },
      ]),
    ),
  };
}

export class FileGuardianStateStore implements GuardianStateStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  async load(): Promise<GuardianState> {
    try {
      const contents = await readFile(this.#path, "utf8");
      return deserializeState(JSON.parse(contents) as SerializedGuardianState);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createEmptyGuardianState();
      }
      throw error;
    }
  }

  async save(state: GuardianState): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    const temporaryPath = `${this.#path}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(serializeState(state), null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.#path);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

export class MemoryGuardianStateStore implements GuardianStateStore {
  #state: GuardianState;

  constructor(state: GuardianState = createEmptyGuardianState()) {
    this.#state = structuredClone(state);
  }

  async load(): Promise<GuardianState> {
    return structuredClone(this.#state);
  }

  async save(state: GuardianState): Promise<void> {
    this.#state = structuredClone(state);
  }
}
