import { describe, expect, it } from "vitest";
import {
  calculateTriggerAssets,
  erc20UsdcToNative,
  formatUsdc,
  nativeUsdcToErc20,
  parseUsdc,
} from "./money.js";

describe("Arc USDC units", () => {
  it("parses and formats ERC-20 USDC with six decimals", () => {
    expect(parseUsdc("1.25")).toBe(1_250_000n);
    expect(formatUsdc(1_250_000n)).toBe("1.25");
  });

  it("converts between Arc's ERC-20 and native USDC representations", () => {
    const erc20Amount = 1_000_001n;
    const nativeAmount = erc20UsdcToNative(erc20Amount);

    expect(nativeAmount).toBe(1_000_001_000_000_000_000n);
    expect(nativeUsdcToErc20(nativeAmount)).toBe(erc20Amount);
  });

  it("truncates native sub-micro-USDC precision when converting to ERC-20 units", () => {
    expect(nativeUsdcToErc20(999_999_999_999n)).toBe(0n);
  });
});

describe("protection trigger calculation", () => {
  it("calculates a 3% downside trigger", () => {
    expect(calculateTriggerAssets(parseUsdc("1"), 300)).toBe(parseUsdc("0.97"));
  });

  it.each([0, 5_001, 100.5])("rejects invalid basis points: %s", (maxLossBps) => {
    expect(() => calculateTriggerAssets(1_000_000n, maxLossBps)).toThrow(RangeError);
  });

  it("rejects a non-positive principal", () => {
    expect(() => calculateTriggerAssets(0n, 300)).toThrow(RangeError);
  });
});
