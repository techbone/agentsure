import { formatUnits, parseUnits } from "viem";

export const BPS_DENOMINATOR = 10_000n;
export const USDC_ERC20_DECIMALS = 6;
export const USDC_NATIVE_DECIMALS = 18;
export const ARC_NATIVE_TO_ERC20_SCALE = 10n ** 12n;

export function parseUsdc(value: string): bigint {
  return parseUnits(value, USDC_ERC20_DECIMALS);
}

export function formatUsdc(value: bigint): string {
  return formatUnits(value, USDC_ERC20_DECIMALS);
}

export function erc20UsdcToNative(value: bigint): bigint {
  return value * ARC_NATIVE_TO_ERC20_SCALE;
}

export function nativeUsdcToErc20(value: bigint): bigint {
  return value / ARC_NATIVE_TO_ERC20_SCALE;
}

export function calculateTriggerAssets(principalAssets: bigint, maxLossBps: number): bigint {
  if (principalAssets <= 0n) {
    throw new RangeError("principalAssets must be greater than zero");
  }

  if (!Number.isInteger(maxLossBps) || maxLossBps < 1 || maxLossBps > 5_000) {
    throw new RangeError("maxLossBps must be an integer between 1 and 5000");
  }

  const retainedBps = BPS_DENOMINATOR - BigInt(maxLossBps);
  return (principalAssets * retainedBps) / BPS_DENOMINATOR;
}
