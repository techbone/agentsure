import type { JsonLogger } from "./logger.js";
import type { GuardianMetrics } from "./metrics.js";
import type {
  GuardianChainGateway,
  GuardianState,
  GuardianStateStore,
  PolicyLifecycleEvent,
} from "./types.js";

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function compareEvents(left: PolicyLifecycleEvent, right: PolicyLifecycleEvent): number {
  if (left.blockNumber < right.blockNumber) return -1;
  if (left.blockNumber > right.blockNumber) return 1;
  return left.logIndex - right.logIndex;
}

export function applyLifecycleEvent(state: GuardianState, event: PolicyLifecycleEvent): void {
  const policyId = (event.kind === "opened" ? event.policy.policyId : event.policyId).toString();

  if (event.kind === "opened") {
    state.policies[policyId] = event.policy;
    return;
  }

  delete state.policies[policyId];
  if (event.kind === "executed") {
    state.executions[policyId] = {
      policyId: event.policyId,
      status: "confirmed",
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      assetsReturned: event.assetsReturned,
      updatedAt: new Date().toISOString(),
    };
  }
}

export class FinalizedPolicyMonitor {
  readonly #backfillDelayMs: number;
  readonly #batchSize: bigint;
  readonly #chain: GuardianChainGateway;
  readonly #logger: JsonLogger;
  readonly #metrics: GuardianMetrics;
  readonly #startBlock: bigint;
  readonly #store: GuardianStateStore;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  constructor(options: {
    backfillDelayMs?: number;
    batchSize: bigint;
    chain: GuardianChainGateway;
    logger: JsonLogger;
    metrics: GuardianMetrics;
    startBlock: bigint;
    store: GuardianStateStore;
    sleep?: (milliseconds: number) => Promise<void>;
  }) {
    this.#backfillDelayMs = options.backfillDelayMs ?? 0;
    this.#batchSize = options.batchSize;
    this.#chain = options.chain;
    this.#logger = options.logger;
    this.#metrics = options.metrics;
    this.#startBlock = options.startBlock;
    this.#store = options.store;
    this.#sleep = options.sleep ?? defaultSleep;
  }

  async sync(state: GuardianState): Promise<void> {
    const finalizedBlock = await this.#chain.getFinalizedBlockNumber();
    this.#metrics.lastFinalizedBlock = finalizedBlock;

    let fromBlock =
      state.lastProcessedBlock === null ? this.#startBlock : state.lastProcessedBlock + 1n;
    while (fromBlock <= finalizedBlock) {
      const toBlock =
        fromBlock + this.#batchSize - 1n < finalizedBlock
          ? fromBlock + this.#batchSize - 1n
          : finalizedBlock;
      const events = (await this.#chain.getLifecycleEvents(fromBlock, toBlock)).sort(compareEvents);

      for (const event of events) {
        applyLifecycleEvent(state, event);
      }

      state.lastProcessedBlock = toBlock;
      await this.#store.save(state);
      const logLevel = events.length > 0 ? "info" : "debug";
      this.#logger[logLevel]("finalized block range indexed", {
        fromBlock,
        toBlock,
        eventCount: events.length,
      });
      fromBlock = toBlock + 1n;
      if (fromBlock <= finalizedBlock && this.#backfillDelayMs > 0) {
        await this.#sleep(this.#backfillDelayMs);
      }
    }

    this.#metrics.activePolicyCount = Object.keys(state.policies).length;
  }
}
