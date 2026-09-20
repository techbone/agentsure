import { protectionManagerAbi } from "@agentsure/chain";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc, arcTestnet } from "viem/chains";
import type {
  ExecutionReceipt,
  GuardianChainGateway,
  OnchainPolicy,
  PolicyLifecycleEvent,
  SimulationRequest,
  SubmittedExecution,
} from "./types.js";

function requiredLogIdentity(log: {
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: Hash | null;
}) {
  if (log.blockNumber === null || log.logIndex === null || log.transactionHash === null) {
    throw new Error("Finalized Arc log is missing its immutable identity");
  }
  return {
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    transactionHash: log.transactionHash,
  };
}

export class ViemGuardianGateway implements GuardianChainGateway {
  readonly #account;
  readonly #managerAddress: Address;
  readonly #publicClient;
  readonly #walletClient;

  constructor(options: {
    chainId: 5_042 | 5_042_002;
    managerAddress: Address;
    privateKey: Hex;
    rpcUrl: string;
  }) {
    this.#account = privateKeyToAccount(options.privateKey);
    this.#managerAddress = options.managerAddress;
    const chain = options.chainId === arc.id ? arc : arcTestnet;
    this.#publicClient = createPublicClient({
      chain,
      transport: http(options.rpcUrl),
    });
    this.#walletClient = createWalletClient({
      account: this.#account,
      chain,
      transport: http(options.rpcUrl),
    });
  }

  get keeperAddress(): Address {
    return this.#account.address;
  }

  async getFinalizedBlockNumber(): Promise<bigint> {
    const block = await this.#publicClient.getBlock({ blockTag: "finalized" });
    return block.number;
  }

  async getLifecycleEvents(fromBlock: bigint, toBlock: bigint): Promise<PolicyLifecycleEvent[]> {
    const logs = await this.#publicClient.getLogs({
      address: this.#managerAddress,
      fromBlock,
      toBlock,
    });
    const events: PolicyLifecycleEvent[] = [];

    for (const log of logs) {
      const decoded = (() => {
        try {
          return decodeEventLog({
            abi: protectionManagerAbi,
            data: log.data,
            topics: log.topics,
            strict: true,
          });
        } catch {
          return null;
        }
      })();
      if (decoded === null) continue;
      const identity = requiredLogIdentity(log);

      if (decoded.eventName === "PolicyOpened") {
        const args = decoded.args;
        events.push({
          ...identity,
          kind: "opened",
          policy: {
            policyId: args.policyId,
            owner: args.owner,
            beneficiary: args.beneficiary,
            vault: args.vault,
            principalAssets: args.principalAssets,
            shares: args.shares,
            triggerAssets: args.triggerAssets,
            lossLimitBps: args.lossLimitBps,
            expiresAt: args.expiresAt,
            openedBlock: identity.blockNumber,
            openedTransactionHash: identity.transactionHash,
          },
        });
        continue;
      }

      if (
        decoded.eventName === "ProtectionExecuted" ||
        decoded.eventName === "PolicyCancelled" ||
        decoded.eventName === "ExpiredPolicyClosed"
      ) {
        events.push({
          ...identity,
          kind:
            decoded.eventName === "ProtectionExecuted"
              ? "executed"
              : decoded.eventName === "PolicyCancelled"
                ? "cancelled"
                : "expired",
          policyId: decoded.args.policyId,
          assetsReturned: decoded.args.assetsReturned,
        });
      }
    }

    return events;
  }

  async getPolicy(policyId: bigint): Promise<OnchainPolicy> {
    return this.#publicClient.readContract({
      address: this.#managerAddress,
      abi: protectionManagerAbi,
      functionName: "getPolicy",
      args: [policyId],
    });
  }

  async getPolicyValue(policyId: bigint): Promise<bigint> {
    return this.#publicClient.readContract({
      address: this.#managerAddress,
      abi: protectionManagerAbi,
      functionName: "getPolicyValue",
      args: [policyId],
    });
  }

  async simulateExecution(policyId: bigint, minimumAssets: bigint): Promise<SimulationRequest> {
    const simulation = await this.#publicClient.simulateContract({
      account: this.#account,
      address: this.#managerAddress,
      abi: protectionManagerAbi,
      functionName: "executeProtection",
      args: [policyId, minimumAssets],
    });
    return { policyId, minimumAssets, request: simulation.request };
  }

  async submitExecution(simulation: SimulationRequest): Promise<SubmittedExecution> {
    const transactionHash = await this.#walletClient.writeContract({
      account: this.#account,
      chain: this.#walletClient.chain,
      address: this.#managerAddress,
      abi: protectionManagerAbi,
      functionName: "executeProtection",
      args: [simulation.policyId, simulation.minimumAssets],
    });
    return { transactionHash };
  }

  async waitForExecution(transactionHash: Hash): Promise<ExecutionReceipt> {
    const receipt = await this.#publicClient.waitForTransactionReceipt({ hash: transactionHash });
    return {
      transactionHash,
      blockNumber: receipt.blockNumber,
      success: receipt.status === "success",
    };
  }
}
