import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PolicyExecutionPlan } from "@/lib/policy-plan";
import { PolicyBuilder } from "./policy-builder.js";

const WALLET = "0x218b80d3bCDaB79C66ee24AA15A3c8e2527f5E21";
const VAULT = "0xa70344cEeA5598B836B148B0d83b19eE988b4599";

const preparedPlan: PolicyExecutionPlan = {
  agentInstruction: "Execute the exact AgentSure calls.",
  deployment: {
    chainId: 5_042_002,
    manager: "0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5",
    network: "Arc Testnet",
    usdc: "0x3600000000000000000000000000000000000000",
    vault: VAULT,
    wallet: WALLET,
  },
  intentId: `0x${"1".repeat(64)}`,
  policyNumberAtPreparation: "2",
  schemaVersion: 1,
  source: { blockNumber: "63229388", kind: "finalized-arc-state" },
  steps: [
    {
      calldata: "0x095ea7b3",
      cliCommand: "circle wallet execute approve",
      description: "Authorize exactly 2.01 USDC for principal and fee.",
      functionSignature: "approve(address,uint256)",
      id: "approve",
      target: "0x3600000000000000000000000000000000000000",
    },
    {
      calldata: "0x12345678",
      cliCommand: "circle wallet execute openPolicy",
      description: "Open the bounded position with a 1.9 USDC trigger.",
      functionSignature: "openPolicy(address,address,uint256,uint16,uint64,uint256)",
      id: "open-policy",
      target: "0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5",
    },
  ],
  terms: {
    authorizationAssets: "2010000",
    durationSeconds: 86_400,
    entrySlippageBps: 100,
    lossLimitBps: 500,
    minimumShares: "1980000",
    previewShares: "2000000",
    principalAssets: "2000000",
    protectionFeeAssets: "10000",
    triggerAssets: "1900000",
  },
  wallet: {
    address: WALLET,
    balanceAssets: "19457500",
    custody: "Circle Agent Wallet / 2-of-2 MPC",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("policy builder", () => {
  it("prepares a finalized execution handoff for valid terms", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(preparedPlan),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PolicyBuilder beneficiary={WALLET} vault={VAULT} />);

    fireEvent.change(screen.getByLabelText("Position size in USDC"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Maximum downside percentage"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare agent handoff" }));

    expect(await screen.findByText("Ready for", { exact: false })).not.toBeNull();
    expect(screen.getByText("1.9 USDC")).not.toBeNull();
    expect(screen.getByText("2.01 USDC")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects amounts above the deployed testnet cap without calling the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PolicyBuilder beneficiary={WALLET} vault={VAULT} />);
    fireEvent.change(screen.getByLabelText("Position size in USDC"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare agent handoff" }));

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
