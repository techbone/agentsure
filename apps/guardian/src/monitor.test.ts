import { describe, expect, it } from "vitest";
import { JsonLogger } from "./logger.js";
import { GuardianMetrics } from "./metrics.js";
import { FinalizedPolicyMonitor } from "./monitor.js";
import { MemoryGuardianStateStore, createEmptyGuardianState } from "./store.js";
import { FakeGuardianGateway, TEST_HASH, trackedPolicy } from "./test-helpers.js";

const quietLogger = new JsonLogger(() => undefined);

function openedEvent(blockNumber = 10n, logIndex = 0) {
  return {
    kind: "opened" as const,
    blockNumber,
    logIndex,
    transactionHash: TEST_HASH,
    policy: { ...trackedPolicy(), openedBlock: blockNumber },
  };
}

describe("finalized policy monitor", () => {
  it("resumes from the block after its durable cursor", async () => {
    const chain = new FakeGuardianGateway();
    chain.events = [openedEvent()];
    const store = new MemoryGuardianStateStore();
    const firstState = createEmptyGuardianState();
    const firstMonitor = new FinalizedPolicyMonitor({
      batchSize: 100n,
      chain,
      logger: quietLogger,
      metrics: new GuardianMetrics(),
      startBlock: 10n,
      store,
    });
    await firstMonitor.sync(firstState);

    chain.finalizedBlock = 12n;
    const restartedState = await store.load();
    const restartedMonitor = new FinalizedPolicyMonitor({
      batchSize: 100n,
      chain,
      logger: quietLogger,
      metrics: new GuardianMetrics(),
      startBlock: 10n,
      store,
    });
    await restartedMonitor.sync(restartedState);

    expect(chain.eventRequests).toEqual([
      { fromBlock: 10n, toBlock: 10n },
      { fromBlock: 11n, toBlock: 12n },
    ]);
    expect(Object.keys(restartedState.policies)).toEqual(["1"]);
    expect(restartedState.lastProcessedBlock).toBe(12n);
  });

  it("orders same-block events by log index before applying them", async () => {
    const chain = new FakeGuardianGateway();
    chain.events = [
      {
        kind: "cancelled",
        blockNumber: 10n,
        logIndex: 2,
        transactionHash: TEST_HASH,
        policyId: 1n,
        assetsReturned: 1_000_000n,
      },
      openedEvent(10n, 1),
    ];
    const state = createEmptyGuardianState();
    const store = new MemoryGuardianStateStore();
    const monitor = new FinalizedPolicyMonitor({
      batchSize: 100n,
      chain,
      logger: quietLogger,
      metrics: new GuardianMetrics(),
      startBlock: 10n,
      store,
    });

    await monitor.sync(state);

    expect(state.policies).toEqual({});
  });

  it("does not query or duplicate a finalized range twice", async () => {
    const chain = new FakeGuardianGateway();
    chain.events = [openedEvent()];
    const state = createEmptyGuardianState();
    const monitor = new FinalizedPolicyMonitor({
      batchSize: 100n,
      chain,
      logger: quietLogger,
      metrics: new GuardianMetrics(),
      startBlock: 10n,
      store: new MemoryGuardianStateStore(),
    });

    await monitor.sync(state);
    await monitor.sync(state);

    expect(chain.eventRequests).toHaveLength(1);
    expect(Object.keys(state.policies)).toEqual(["1"]);
  });

  it("paces historical ranges without delaying the final range", async () => {
    const chain = new FakeGuardianGateway();
    chain.finalizedBlock = 14n;
    const delays: number[] = [];
    const monitor = new FinalizedPolicyMonitor({
      backfillDelayMs: 500,
      batchSize: 2n,
      chain,
      logger: quietLogger,
      metrics: new GuardianMetrics(),
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      startBlock: 10n,
      store: new MemoryGuardianStateStore(),
    });

    await monitor.sync(createEmptyGuardianState());

    expect(chain.eventRequests).toEqual([
      { fromBlock: 10n, toBlock: 11n },
      { fromBlock: 12n, toBlock: 13n },
      { fromBlock: 14n, toBlock: 14n },
    ]);
    expect(delays).toEqual([500, 500]);
  });
});
