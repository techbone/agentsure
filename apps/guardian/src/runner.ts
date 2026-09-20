import type { PolicyEvaluation, PolicyEvaluator } from "./evaluator.js";
import type { ProtectionExecutor } from "./executor.js";
import type { JsonLogger } from "./logger.js";
import type { GuardianMetrics } from "./metrics.js";
import type { FinalizedPolicyMonitor } from "./monitor.js";
import { withRetry, type RetryOptions } from "./retry.js";
import type { GuardianState, GuardianStateStore } from "./types.js";

export class GuardianRunner {
  readonly #evaluator: PolicyEvaluator;
  readonly #executor: ProtectionExecutor;
  readonly #logger: JsonLogger;
  readonly #metrics: GuardianMetrics;
  readonly #monitor: FinalizedPolicyMonitor;
  readonly #pollIntervalMs: number;
  readonly #retry: RetryOptions;
  readonly #store: GuardianStateStore;
  #state: GuardianState | null = null;

  constructor(options: {
    evaluator: PolicyEvaluator;
    executor: ProtectionExecutor;
    logger: JsonLogger;
    metrics: GuardianMetrics;
    monitor: FinalizedPolicyMonitor;
    pollIntervalMs: number;
    retry: RetryOptions;
    store: GuardianStateStore;
  }) {
    this.#evaluator = options.evaluator;
    this.#executor = options.executor;
    this.#logger = options.logger;
    this.#metrics = options.metrics;
    this.#monitor = options.monitor;
    this.#pollIntervalMs = options.pollIntervalMs;
    this.#retry = options.retry;
    this.#store = options.store;
  }

  async initialize(): Promise<void> {
    this.#state = await this.#store.load();
    this.#metrics.activePolicyCount = Object.keys(this.#state.policies).length;
  }

  async runOnce(): Promise<void> {
    if (this.#state === null) {
      throw new Error("GuardianRunner must be initialized before running");
    }
    const state = this.#state;

    try {
      await withRetry(() => this.#monitor.sync(state), this.#retry);
    } catch (error) {
      this.#metrics.rpcFailuresTotal += 1;
      throw error;
    }

    const policies = Object.values(state.policies).sort((left, right) =>
      left.policyId < right.policyId ? -1 : left.policyId > right.policyId ? 1 : 0,
    );
    for (const trackedPolicy of policies) {
      const execution = state.executions[trackedPolicy.policyId.toString()];
      if (execution?.status === "submitted") {
        await this.#executor.resume(state, trackedPolicy.policyId, execution.transactionHash);
        continue;
      }

      let evaluation: PolicyEvaluation;
      try {
        evaluation = await withRetry(
          () => this.#evaluator.evaluate(trackedPolicy.policyId),
          this.#retry,
        );
      } catch (error) {
        this.#metrics.rpcFailuresTotal += 1;
        this.#logger.error("policy evaluation failed", {
          error,
          policyId: trackedPolicy.policyId,
        });
        continue;
      }

      if (evaluation.decision === "ignore") {
        if (evaluation.reason === "not-active") {
          delete state.policies[trackedPolicy.policyId.toString()];
          await this.#store.save(state);
        }
        this.#logger.debug("policy does not require execution", {
          policyId: trackedPolicy.policyId,
          reason: evaluation.reason,
        });
        continue;
      }

      this.#logger.info("policy breach verified", {
        currentAssets: evaluation.currentAssets,
        minimumAssets: evaluation.minimumAssets,
        policyId: trackedPolicy.policyId,
      });
      await this.#executor.execute(state, trackedPolicy.policyId, evaluation.minimumAssets);
    }

    this.#metrics.activePolicyCount = Object.keys(state.policies).length;
    this.#metrics.lastSuccessfulCycleTimestampSeconds = Math.floor(Date.now() / 1000);
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.runOnce();
      } catch (error) {
        this.#logger.error("guardian cycle failed", { error });
      }

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, this.#pollIntervalMs);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    }
  }
}
