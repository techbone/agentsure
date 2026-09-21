import { describe, expect, it } from "vitest";
import { loadLifecycleConfig, loadTestnetLifecycleConfig } from "./config.js";

describe("testnet lifecycle configuration", () => {
  it("uses the capped one-USDC demonstration terms", () => {
    const config = loadTestnetLifecycleConfig({});

    expect(config.principalAssets).toBe(1_000_000n);
    expect(config.lossAssets).toBe(32_500n);
    expect(config.lossLimitBps).toBe(300);
    expect(config.durationSeconds).toBe(86_400n);
    expect(config.minimumShares).toBe(990_000n);
  });

  it("accepts only valid override addresses", () => {
    expect(() => loadTestnetLifecycleConfig({ AGENTSURE_AGENT_WALLET: "invalid" })).toThrow();
  });

  it("requires explicit acknowledgement and addresses for mainnet", () => {
    expect(() => loadLifecycleConfig({ AGENTSURE_E2E_NETWORK: "mainnet" })).toThrow("I_UNDERSTAND");
    expect(() =>
      loadLifecycleConfig({
        AGENTSURE_E2E_ACKNOWLEDGE_MAINNET: "I_UNDERSTAND",
        AGENTSURE_E2E_NETWORK: "mainnet",
      }),
    ).toThrow("GUARDIAN_MANAGER_ADDRESS");
  });

  it("keeps the mainnet guardian funding floor at one cent", () => {
    const config = loadLifecycleConfig({
      AGENTSURE_AGENT_WALLET: "0x1111111111111111111111111111111111111111",
      AGENTSURE_E2E_ACKNOWLEDGE_MAINNET: "I_UNDERSTAND",
      AGENTSURE_E2E_NETWORK: "mainnet",
      GUARDIAN_EXPECTED_ADDRESS: "0x58E92E6AF85D2F05237B8b948Af185B5e40ab1fC",
      GUARDIAN_MANAGER_ADDRESS: "0x2222222222222222222222222222222222222222",
      GUARDIAN_START_BLOCK: "1",
      NEXT_PUBLIC_DEMO_RISK_VAULT_ADDRESS: "0x3333333333333333333333333333333333333333",
    });

    expect(config.guardianMinimumBalanceAssets).toBe(10_000n);
  });
});
