import type { Address, Hash } from "viem";
import type {
  ExecutionReceipt,
  GuardianChainGateway,
  OnchainPolicy,
  PolicyLifecycleEvent,
  SimulationRequest,
  SubmittedExecution,
  TrackedPolicy,
} from "./types.js";

export const TEST_OWNER = "0x0000000000000000000000000000000000000001" as Address;
export const TEST_BENEFICIARY = "0x0000000000000000000000000000000000000002" as Address;
export const TEST_VAULT = "0x0000000000000000000000000000000000000003" as Address;
export const TEST_HASH = `0x${"1".repeat(64)}` as Hash;

export function trackedPolicy(policyId = 1n): TrackedPolicy {
  return {
    policyId,
    owner: TEST_OWNER,
    beneficiary: TEST_BENEFICIARY,
    vault: TEST_VAULT,
    principalAssets: 1_000_000n,
    shares: 1_000_000n,
    triggerAssets: 970_000n,
    lossLimitBps: 300,
    expiresAt: 2_000n,
    openedBlock: 10n,
    openedTransactionHash: TEST_HASH,
  };
}

export function onchainPolicy(overrides: Partial<OnchainPolicy> = {}): OnchainPolicy {
  return {
    owner: TEST_OWNER,
    beneficiary: TEST_BENEFICIARY,
    vault: TEST_VAULT,
    principalAssets: 1_000_000n,
    shares: 1_000_000n,
    triggerAssets: 970_000n,
    assetsReturned: 0n,
    openedAt: 1_000n,
    expiresAt: 2_000n,
    lossLimitBps: 300,
    status: 0,
    ...overrides,
  };
}

export class FakeGuardianGateway implements GuardianChainGateway {
  events: PolicyLifecycleEvent[] = [];
  finalizedBlock = 10n;
  policies = new Map<bigint, OnchainPolicy>();
  policyValues = new Map<bigint, bigint>();
  eventRequests: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  simulationCalls: Array<{ policyId: bigint; minimumAssets: bigint }> = [];
  submissionCalls: SimulationRequest[] = [];
  simulationError: Error | null = null;
  submissionError: Error | null = null;
  receipt: ExecutionReceipt = {
    transactionHash: TEST_HASH,
    blockNumber: 11n,
    success: true,
  };

  async getFinalizedBlockNumber(): Promise<bigint> {
    return this.finalizedBlock;
  }

  async getLifecycleEvents(fromBlock: bigint, toBlock: bigint): Promise<PolicyLifecycleEvent[]> {
    this.eventRequests.push({ fromBlock, toBlock });
    return this.events.filter(
      (event) => event.blockNumber >= fromBlock && event.blockNumber <= toBlock,
    );
  }

  async getPolicy(policyId: bigint): Promise<OnchainPolicy> {
    const policy = this.policies.get(policyId);
    if (policy === undefined) throw new Error(`Missing fake policy ${policyId}`);
    return policy;
  }

  async getPolicyValue(policyId: bigint): Promise<bigint> {
    const value = this.policyValues.get(policyId);
    if (value === undefined) throw new Error(`Missing fake value ${policyId}`);
    return value;
  }

  async simulateExecution(policyId: bigint, minimumAssets: bigint): Promise<SimulationRequest> {
    this.simulationCalls.push({ policyId, minimumAssets });
    if (this.simulationError !== null) throw this.simulationError;
    return { policyId, minimumAssets, request: { valid: true } };
  }

  async submitExecution(simulation: SimulationRequest): Promise<SubmittedExecution> {
    this.submissionCalls.push(simulation);
    if (this.submissionError !== null) throw this.submissionError;
    return { transactionHash: TEST_HASH };
  }

  async waitForExecution(): Promise<ExecutionReceipt> {
    return this.receipt;
  }
}
