import { describe, expect, it } from "vitest";
import { loadTestnetLifecycleConfig } from "./config.js";

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
});
