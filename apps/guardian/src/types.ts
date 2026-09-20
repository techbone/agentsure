import type { Address, Hash } from "viem";

export const POLICY_STATUS = {
  active: 0,
  executed: 1,
  cancelled: 2,
  expired: 3,
} as const;

export type OnchainPolicy = {
  owner: Address;
  beneficiary: Address;
  vault: Address;
  principalAssets: bigint;
  shares: bigint;
  triggerAssets: bigint;
  assetsReturned: bigint;
  openedAt: bigint;
  expiresAt: bigint;
  lossLimitBps: number;
  status: number;
};

export type TrackedPolicy = {
  policyId: bigint;
  owner: Address;
  beneficiary: Address;
  vault: Address;
  principalAssets: bigint;
  shares: bigint;
  triggerAssets: bigint;
  lossLimitBps: number;
  expiresAt: bigint;
  openedBlock: bigint;
  openedTransactionHash: Hash;
};

type EventIdentity = {
  blockNumber: bigint;
  logIndex: number;
  transactionHash: Hash;
};

export type PolicyLifecycleEvent =
  | (EventIdentity & {
      kind: "opened";
      policy: TrackedPolicy;
    })
  | (EventIdentity & {
      kind: "executed" | "cancelled" | "expired";
      policyId: bigint;
      assetsReturned: bigint;
    });

export type ExecutionRecord = {
  policyId: bigint;
  status: "submitted" | "confirmed" | "reverted";
  transactionHash: Hash;
  blockNumber: bigint | null;
  assetsReturned: bigint | null;
  updatedAt: string;
};

export type GuardianState = {
  schemaVersion: 1;
  lastProcessedBlock: bigint | null;
  policies: Record<string, TrackedPolicy>;
  executions: Record<string, ExecutionRecord>;
};

export type SimulationRequest = {
  policyId: bigint;
  minimumAssets: bigint;
  request: unknown;
};

export type SubmittedExecution = {
  transactionHash: Hash;
};

export type ExecutionReceipt = {
  transactionHash: Hash;
  blockNumber: bigint;
  success: boolean;
};

export interface GuardianChainGateway {
  getFinalizedBlockNumber(): Promise<bigint>;
  getLifecycleEvents(fromBlock: bigint, toBlock: bigint): Promise<PolicyLifecycleEvent[]>;
  getPolicy(policyId: bigint): Promise<OnchainPolicy>;
  getPolicyValue(policyId: bigint): Promise<bigint>;
  simulateExecution(policyId: bigint, minimumAssets: bigint): Promise<SimulationRequest>;
  submitExecution(simulation: SimulationRequest): Promise<SubmittedExecution>;
  waitForExecution(transactionHash: Hash): Promise<ExecutionReceipt>;
}

export interface GuardianStateStore {
  load(): Promise<GuardianState>;
  save(state: GuardianState): Promise<void>;
}
