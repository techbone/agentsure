import { describe, expect, it } from "vitest";
import { loadGuardianConfig } from "./config.js";

const validEnvironment = {
  GUARDIAN_MANAGER_ADDRESS: "0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5",
  GUARDIAN_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  GUARDIAN_START_BLOCK: "63052386",
};

describe("guardian configuration", () => {
  it("loads bounded defaults without exposing a user-wallet credential field", () => {
    const config = loadGuardianConfig(validEnvironment);

    expect(config.startBlock).toBe(63_052_386n);
    expect(config.chainId).toBe(5_042_002);
    expect(config.blockBatchSize).toBe(2_000n);
    expect(config.backfillDelayMs).toBe(500);
    expect(config.exitSlippageBps).toBe(100);
    expect(config.retryAttempts).toBe(6);
    expect(config.retryBaseDelayMs).toBe(500);
    expect(Object.keys(config)).not.toContain("userWalletPrivateKey");
  });

  it("selects the Arc mainnet endpoint by chain ID", () => {
    const config = loadGuardianConfig({
      ...validEnvironment,
      ARC_MAINNET_RPC_URL: "https://mainnet.example.com",
      GUARDIAN_CHAIN_ID: "5042",
    });

    expect(config.chainId).toBe(5_042);
    expect(config.rpcUrl).toBe("https://mainnet.example.com");
  });

  it("uses Railway's injected port and attached volume by default", () => {
    const config = loadGuardianConfig({
      ...validEnvironment,
      PORT: "8080",
      RAILWAY_VOLUME_MOUNT_PATH: "/data",
    });

    expect(config.httpPort).toBe(8_080);
    expect(config.statePath).toBe("/data/guardian-state.json");
  });

  it("allows explicit guardian paths and ports to override platform values", () => {
    const config = loadGuardianConfig({
      ...validEnvironment,
      GUARDIAN_HTTP_PORT: "9464",
      GUARDIAN_STATE_PATH: "/custom/state.json",
      PORT: "8080",
      RAILWAY_VOLUME_MOUNT_PATH: "/data",
    });

    expect(config.httpPort).toBe(9_464);
    expect(config.statePath).toBe("/custom/state.json");
  });

  it("rejects an unsafe exit slippage bound", () => {
    expect(() =>
      loadGuardianConfig({ ...validEnvironment, GUARDIAN_EXIT_SLIPPAGE_BPS: "501" }),
    ).toThrow("must not exceed 500");
  });

  it("rejects a malformed keeper private key", () => {
    expect(() =>
      loadGuardianConfig({ ...validEnvironment, GUARDIAN_PRIVATE_KEY: "not-a-key" }),
    ).toThrow();
  });
});
