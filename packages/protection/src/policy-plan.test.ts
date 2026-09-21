import { protectionManagerAbi } from "@agentsure/chain/protection-manager";
import { decodeFunctionData, erc20Abi } from "viem";
import { describe, expect, it } from "vitest";
import {
  createPolicyExecutionPlan,
  PolicyPlanError,
  type PolicyPlanDeployment,
  type PolicyPlanOnchainState,
} from "./policy-plan.js";

const deployment: PolicyPlanDeployment = {
  chainId: 5_042_002,
  manager: "0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5",
  network: "Arc Testnet",
  usdc: "0x3600000000000000000000000000000000000000",
  vault: "0xa70344cEeA5598B836B148B0d83b19eE988b4599",
  wallet: "0x218b80d3bCDaB79C66ee24AA15A3c8e2527f5E21",
};

const onchain: PolicyPlanOnchainState = {
  assetToken: deployment.usdc,
  isVaultAllowed: true,
  maxDepositAssets: 10_000_000n,
  maxDurationSeconds: 604_800n,
  maxLossLimitBps: 5_000,
  maxPrincipalAssets: 2_000_000n,
  minDurationSeconds: 300n,
  minimumLossLimitBps: 100,
  nextPolicyId: 2n,
  observedBlock: 63_229_388n,
  paused: false,
  previewShares: 1_000_000n,
  protectionFeeAssets: 10_000n,
  walletBalanceAssets: 19_457_500n,
};

const intent = {
  amountUsdc: "1",
  beneficiary: deployment.wallet,
  durationSeconds: 86_400,
  maxLossBps: 300,
  vault: deployment.vault,
};

describe("AgentSure policy execution plan", () => {
  it("encodes exact bounded Circle Agent Wallet calls", () => {
    const plan = createPolicyExecutionPlan({ deployment, intent, onchain });
    const approval = decodeFunctionData({ abi: erc20Abi, data: plan.steps[0].calldata });
    const opening = decodeFunctionData({
      abi: protectionManagerAbi,
      data: plan.steps[1].calldata,
    });

    expect(approval.functionName).toBe("approve");
    expect(approval.args).toEqual([deployment.manager, 1_010_000n]);
    expect(opening.functionName).toBe("openPolicy");
    expect(opening.args).toEqual([
      deployment.vault,
      deployment.wallet,
      1_000_000n,
      300,
      86_400n,
      990_000n,
    ]);
    expect(plan.terms.triggerAssets).toBe("970000");
    expect(plan.source.kind).toBe("finalized-arc-state");
    expect(plan.steps[0].cliCommand).toContain('"approve(address,uint256)"');
    expect(plan.steps[1].cliCommand).toContain(
      '"openPolicy(address,address,uint256,uint16,uint64,uint256)"',
    );
    expect(plan.agentInstruction).toContain("Do not alter the targets");
  });

  it("produces the same intent id for the same confirmed terms", () => {
    const first = createPolicyExecutionPlan({ deployment, intent, onchain });
    const second = createPolicyExecutionPlan({
      deployment,
      intent,
      onchain: { ...onchain, observedBlock: onchain.observedBlock + 10n },
    });

    expect(first.intentId).toBe(second.intentId);
  });

  it("refuses to prepare a plan when wallet funds are insufficient", () => {
    expect(() =>
      createPolicyExecutionPlan({
        deployment,
        intent,
        onchain: { ...onchain, walletBalanceAssets: 1_000_000n },
      }),
    ).toThrow(PolicyPlanError);
  });
});
