import { describe, expect, it } from "vitest";
import { PolicyEvaluator } from "./evaluator.js";
import { FakeGuardianGateway, onchainPolicy } from "./test-helpers.js";

describe("policy evaluator", () => {
  it("returns an executable breach with bounded exit slippage", async () => {
    const chain = new FakeGuardianGateway();
    chain.policies.set(1n, onchainPolicy());
    chain.policyValues.set(1n, 969_000n);
    const evaluator = new PolicyEvaluator({ chain, exitSlippageBps: 100, now: () => 1_500n });

    await expect(evaluator.evaluate(1n)).resolves.toEqual({
      decision: "execute",
      currentAssets: 969_000n,
      minimumAssets: 959_310n,
    });
  });

  it("rejects a value above the trigger", async () => {
    const chain = new FakeGuardianGateway();
    chain.policies.set(1n, onchainPolicy());
    chain.policyValues.set(1n, 970_001n);
    const evaluator = new PolicyEvaluator({ chain, exitSlippageBps: 100, now: () => 1_500n });

    await expect(evaluator.evaluate(1n)).resolves.toEqual({
      decision: "ignore",
      reason: "trigger-not-met",
    });
    expect(chain.simulationCalls).toHaveLength(0);
    expect(chain.submissionCalls).toHaveLength(0);
  });

  it("rejects an expired policy before reading its value", async () => {
    const chain = new FakeGuardianGateway();
    chain.policies.set(1n, onchainPolicy());
    const evaluator = new PolicyEvaluator({ chain, exitSlippageBps: 100, now: () => 2_000n });

    await expect(evaluator.evaluate(1n)).resolves.toEqual({
      decision: "ignore",
      reason: "expired",
    });
  });

  it("rejects an already closed policy", async () => {
    const chain = new FakeGuardianGateway();
    chain.policies.set(1n, onchainPolicy({ status: 1 }));
    const evaluator = new PolicyEvaluator({ chain, exitSlippageBps: 100, now: () => 1_500n });

    await expect(evaluator.evaluate(1n)).resolves.toEqual({
      decision: "ignore",
      reason: "not-active",
    });
  });
});
