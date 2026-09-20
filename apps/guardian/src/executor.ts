import type { JsonLogger } from "./logger.js";
import type { GuardianMetrics } from "./metrics.js";
import { withRetry, type RetryOptions } from "./retry.js";
import type {
  GuardianChainGateway,
  GuardianState,
  GuardianStateStore,
  SimulationRequest,
} from "./types.js";
import type { Hash } from "viem";

export class ProtectionExecutor {
  readonly #chain: GuardianChainGateway;
  readonly #logger: JsonLogger;
  readonly #metrics: GuardianMetrics;
  readonly #retry: RetryOptions;
  readonly #store: GuardianStateStore;

  constructor(options: {
    chain: GuardianChainGateway;
    logger: JsonLogger;
    metrics: GuardianMetrics;
    retry: RetryOptions;
    store: GuardianStateStore;
  }) {
    this.#chain = options.chain;
    this.#logger = options.logger;
    this.#metrics = options.metrics;
    this.#retry = options.retry;
    this.#store = options.store;
  }

  async execute(state: GuardianState, policyId: bigint, minimumAssets: bigint): Promise<boolean> {
    let simulation: SimulationRequest;
    try {
      simulation = await withRetry(
        () => this.#chain.simulateExecution(policyId, minimumAssets),
        this.#retry,
      );
    } catch (error) {
      this.#metrics.simulationFailuresTotal += 1;
      this.#logger.warn("protection simulation rejected", { error, policyId });
      return false;
    }

    try {
      const submitted = await withRetry(() => this.#chain.submitExecution(simulation), this.#retry);
      state.executions[policyId.toString()] = {
        policyId,
        status: "submitted",
        transactionHash: submitted.transactionHash,
        blockNumber: null,
        assetsReturned: null,
        updatedAt: new Date().toISOString(),
      };
      await this.#store.save(state);
      this.#logger.info("protection transaction submitted", {
        policyId,
        transactionHash: submitted.transactionHash,
      });

      return await this.resume(state, policyId, submitted.transactionHash);
    } catch (error) {
      this.#metrics.executionFailuresTotal += 1;
      this.#logger.error("protection execution failed", { error, policyId });
      return false;
    }
  }

  async resume(state: GuardianState, policyId: bigint, transactionHash: Hash): Promise<boolean> {
    try {
      const receipt = await withRetry(
        () => this.#chain.waitForExecution(transactionHash),
        this.#retry,
      );
      state.executions[policyId.toString()] = {
        policyId,
        status: receipt.success ? "confirmed" : "reverted",
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        assetsReturned: null,
        updatedAt: new Date().toISOString(),
      };
      if (receipt.success) {
        delete state.policies[policyId.toString()];
        this.#metrics.executionsTotal += 1;
      } else {
        this.#metrics.executionFailuresTotal += 1;
      }
      await this.#store.save(state);
      this.#logger.info("protection transaction finalized", {
        policyId,
        success: receipt.success,
        transactionHash: receipt.transactionHash,
      });
      return receipt.success;
    } catch (error) {
      this.#metrics.executionFailuresTotal += 1;
      this.#logger.error("protection receipt reconciliation failed", {
        error,
        policyId,
        transactionHash,
      });
      return false;
    }
  }
}
