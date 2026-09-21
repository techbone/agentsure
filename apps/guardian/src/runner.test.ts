import { describe, expect, it } from "vitest";
import { PolicyEvaluator } from "./evaluator.js";
import { ProtectionExecutor } from "./executor.js";
import { JsonLogger } from "./logger.js";
import { GuardianMetrics } from "./metrics.js";
import { FinalizedPolicyMonitor } from "./monitor.js";
import { GuardianRunner } from "./runner.js";
import { MemoryGuardianStateStore } from "./store.js";
import { FakeGuardianGateway, TEST_HASH, onchainPolicy, trackedPolicy } from "./test-helpers.js";

const retryWithoutDelay = {
  attempts: 1,
  baseDelayMs: 1,
  sleep: async () => undefined,
};

function buildRunner(chain: FakeGuardianGateway) {
  const store = new MemoryGuardianStateStore();
  const logger = new JsonLogger(() => undefined);
  const metrics = new GuardianMetrics();
  const monitor = new FinalizedPolicyMonitor({
    batchSize: 100n,
    chain,
    logger,
    metrics,
    startBlock: 10n,
    store,
  });
  const evaluator = new PolicyEvaluator({
    chain,
    exitSlippageBps: 100,
    now: () => 1_500n,
  });
  const executor = new ProtectionExecutor({
    chain,
    logger,
    metrics,
    retry: retryWithoutDelay,
    store,
  });
  const runner = new GuardianRunner({
    evaluator,
    executor,
    logger,
    metrics,
    monitor,
    pollIntervalMs: 1,
    retry: retryWithoutDelay,
    store,
  });
  return { metrics, runner, store };
}

describe("guardian runner", () => {
  it("automatically executes one valid finalized breach", async () => {
    const chain = new FakeGuardianGateway();
    chain.events = [
      {
        kind: "opened",
        blockNumber: 10n,
        logIndex: 0,
        transactionHash: TEST_HASH,
        policy: trackedPolicy(),
      },
    ];
    chain.policies.set(1n, onchainPolicy());
    chain.policyValues.set(1n, 969_000n);
    const { metrics, runner, store } = buildRunner(chain);

    await runner.initialize();
    await runner.runOnce();

    expect(chain.simulationCalls).toEqual([{ policyId: 1n, minimumAssets: 959_310n }]);
    expect(chain.submissionCalls).toHaveLength(1);
    expect((await store.load()).policies).toEqual({});
    expect(metrics.executionsTotal).toBe(1);
  });

  it("never simulates or submits an invalid breach", async () => {
    const chain = new FakeGuardianGateway();
    chain.events = [
      {
        kind: "opened",
        blockNumber: 10n,
        logIndex: 0,
        transactionHash: TEST_HASH,
        policy: trackedPolicy(),
      },
    ];
    chain.policies.set(1n, onchainPolicy());
    chain.policyValues.set(1n, 970_001n);
    const { runner, store } = buildRunner(chain);

    await runner.initialize();
    await runner.runOnce();

    expect(chain.simulationCalls).toHaveLength(0);
    expect(chain.submissionCalls).toHaveLength(0);
    expect((await store.load()).policies["1"]).toBeDefined();
  });

  it("resumes a submitted transaction after restart without duplicate submission", async () => {
    const chain = new FakeGuardianGateway();
    chain.events = [
      {
        kind: "opened",
        blockNumber: 10n,
        logIndex: 0,
        transactionHash: TEST_HASH,
        policy: trackedPolicy(),
      },
    ];
    chain.policies.set(1n, onchainPolicy());
    chain.policyValues.set(1n, 969_000n);
    const { runner, store } = buildRunner(chain);
    await runner.initialize();
    await runner.runOnce();

    const submittedState = await store.load();
    submittedState.policies["1"] = trackedPolicy();
    submittedState.executions["1"] = {
      ...submittedState.executions["1"],
      policyId: 1n,
      status: "submitted",
      transactionHash: TEST_HASH,
      blockNumber: null,
      assetsReturned: null,
      updatedAt: "2026-09-20T00:00:00.000Z",
    };
    await store.save(submittedState);
    const restarted = buildRunnerFromStore(chain, store);

    await restarted.initialize();
    await restarted.runOnce();

    expect(chain.submissionCalls).toHaveLength(1);
    expect((await store.load()).policies).toEqual({});
  });

  it("recovers from a startup RPC failure before reporting ready", async () => {
    const chain = new FakeGuardianGateway();
    chain.eventFailuresRemaining = 1;
    const { runner } = buildRunner(chain);
    const controller = new AbortController();

    await runner.initialize();
    const ready = await runner.waitUntilReady(controller.signal);

    expect(ready).toBe(true);
    expect(chain.eventRequests).toHaveLength(2);
  });
});

function buildRunnerFromStore(chain: FakeGuardianGateway, store: MemoryGuardianStateStore) {
  const logger = new JsonLogger(() => undefined);
  const metrics = new GuardianMetrics();
  const monitor = new FinalizedPolicyMonitor({
    batchSize: 100n,
    chain,
    logger,
    metrics,
    startBlock: 10n,
    store,
  });
  const evaluator = new PolicyEvaluator({
    chain,
    exitSlippageBps: 100,
    now: () => 1_500n,
  });
  const executor = new ProtectionExecutor({
    chain,
    logger,
    metrics,
    retry: retryWithoutDelay,
    store,
  });
  return new GuardianRunner({
    evaluator,
    executor,
    logger,
    metrics,
    monitor,
    pollIntervalMs: 1,
    retry: retryWithoutDelay,
    store,
  });
}
