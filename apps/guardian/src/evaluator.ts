import { BPS_DENOMINATOR } from "@agentsure/domain";
import { POLICY_STATUS, type GuardianChainGateway } from "./types.js";

export type PolicyEvaluation =
  | { decision: "execute"; currentAssets: bigint; minimumAssets: bigint }
  | { decision: "ignore"; reason: "expired" | "not-active" | "trigger-not-met" };

export class PolicyEvaluator {
  readonly #chain: GuardianChainGateway;
  readonly #exitSlippageBps: number;
  readonly #now: () => bigint;

  constructor(options: {
    chain: GuardianChainGateway;
    exitSlippageBps: number;
    now?: () => bigint;
  }) {
    this.#chain = options.chain;
    this.#exitSlippageBps = options.exitSlippageBps;
    this.#now = options.now ?? (() => BigInt(Math.floor(Date.now() / 1000)));
  }

  async evaluate(policyId: bigint): Promise<PolicyEvaluation> {
    const policy = await this.#chain.getPolicy(policyId);
    if (policy.status !== POLICY_STATUS.active) {
      return { decision: "ignore", reason: "not-active" };
    }
    if (this.#now() >= policy.expiresAt) {
      return { decision: "ignore", reason: "expired" };
    }

    const currentAssets = await this.#chain.getPolicyValue(policyId);
    if (currentAssets > policy.triggerAssets) {
      return { decision: "ignore", reason: "trigger-not-met" };
    }

    const minimumAssets =
      (currentAssets * (BPS_DENOMINATOR - BigInt(this.#exitSlippageBps))) / BPS_DENOMINATOR;
    return { decision: "execute", currentAssets, minimumAssets };
  }
}
