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
});
