import { describe, expect, it } from "vitest";
import { arc, arcTestnet } from "viem/chains";
import {
  ARC_MIN_MAX_FEE_PER_GAS,
  ARC_USDC_ERC20_ADDRESS,
  arcMainnet,
  arcNetworks,
  arcTestNetwork,
} from "./networks.js";

describe("Arc network configuration", () => {
  it("uses the official chain IDs", () => {
    expect(arcMainnet.chain.id).toBe(5_042);
    expect(arcTestNetwork.chain.id).toBe(5_042_002);
  });

  it("uses the shared official USDC ERC-20 interface", () => {
    expect(arcMainnet.usdcAddress).toBe(ARC_USDC_ERC20_ADDRESS);
    expect(arcTestNetwork.usdcAddress).toBe(ARC_USDC_ERC20_ADDRESS);
  });

  it("indexes networks by chain ID", () => {
    expect(arcNetworks[arc.id]).toBe(arcMainnet);
    expect(arcNetworks[arcTestnet.id]).toBe(arcTestNetwork);
  });

  it("enforces Arc's documented 20 Gwei mempool floor", () => {
    expect(ARC_MIN_MAX_FEE_PER_GAS).toBe(20_000_000_000n);
  });
});
