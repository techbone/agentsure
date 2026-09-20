import { describe, expect, it } from "vitest";
import { ProtectionExecutor } from "./executor.js";
import { JsonLogger } from "./logger.js";
import { GuardianMetrics } from "./metrics.js";
import { MemoryGuardianStateStore, createEmptyGuardianState } from "./store.js";
import { FakeGuardianGateway, trackedPolicy } from "./test-helpers.js";

const retryWithoutDelay = {
  attempts: 2,
  baseDelayMs: 1,
  sleep: async () => undefined,
};

describe("protection executor", () => {
  it("never submits a transaction when simulation fails", async () => {
    const chain = new FakeGuardianGateway();
    chain.simulationError = new Error("TriggerNotMet");
    const metrics = new GuardianMetrics();
    const state = createEmptyGuardianState();
    state.policies["1"] = trackedPolicy();
    const executor = new ProtectionExecutor({
      chain,
      logger: new JsonLogger(() => undefined),
      metrics,
      retry: retryWithoutDelay,
      store: new MemoryGuardianStateStore(state),
    });

    await expect(executor.execute(state, 1n, 950_000n)).resolves.toBe(false);

    expect(chain.simulationCalls).toHaveLength(2);
    expect(chain.submissionCalls).toHaveLength(0);
    expect(metrics.simulationFailuresTotal).toBe(1);
  });

  it("records a finalized successful execution and removes the active policy", async () => {
    const chain = new FakeGuardianGateway();
    const state = createEmptyGuardianState();
    state.policies["1"] = trackedPolicy();
    const store = new MemoryGuardianStateStore(state);
    const metrics = new GuardianMetrics();
    const executor = new ProtectionExecutor({
      chain,
      logger: new JsonLogger(() => undefined),
      metrics,
      retry: retryWithoutDelay,
      store,
    });

    await expect(executor.execute(state, 1n, 950_000n)).resolves.toBe(true);

    const saved = await store.load();
    expect(saved.policies).toEqual({});
    expect(saved.executions["1"]?.status).toBe("confirmed");
    expect(chain.submissionCalls).toHaveLength(1);
    expect(metrics.executionsTotal).toBe(1);
  });

  it("keeps an active policy after a reverted receipt", async () => {
    const chain = new FakeGuardianGateway();
    chain.receipt = { ...chain.receipt, success: false };
    const state = createEmptyGuardianState();
    state.policies["1"] = trackedPolicy();
    const store = new MemoryGuardianStateStore(state);
    const metrics = new GuardianMetrics();
    const executor = new ProtectionExecutor({
      chain,
      logger: new JsonLogger(() => undefined),
      metrics,
      retry: retryWithoutDelay,
      store,
    });

    await expect(executor.execute(state, 1n, 950_000n)).resolves.toBe(false);

    expect((await store.load()).policies["1"]).toBeDefined();
    expect(metrics.executionFailuresTotal).toBe(1);
  });

  it("reconciles a previously submitted transaction without submitting another", async () => {
    const chain = new FakeGuardianGateway();
    const state = createEmptyGuardianState();
    state.policies["1"] = trackedPolicy();
    state.executions["1"] = {
      policyId: 1n,
      status: "submitted",
      transactionHash: chain.receipt.transactionHash,
      blockNumber: null,
      assetsReturned: null,
      updatedAt: "2026-09-20T00:00:00.000Z",
    };
    const store = new MemoryGuardianStateStore(state);
    const executor = new ProtectionExecutor({
      chain,
      logger: new JsonLogger(() => undefined),
      metrics: new GuardianMetrics(),
      retry: retryWithoutDelay,
      store,
    });

    await expect(executor.resume(state, 1n, chain.receipt.transactionHash)).resolves.toBe(true);

    expect(chain.submissionCalls).toHaveLength(0);
    expect((await store.load()).policies).toEqual({});
  });
});
