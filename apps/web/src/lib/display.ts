import { formatUsdc } from "@agentsure/domain/money";

export function compactAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function displayUsdc(rawAssets: string | bigint, maximumFractionDigits = 6): string {
  const formatted = formatUsdc(BigInt(rawAssets));
  const [integer, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
  return `${integer ?? "0"}${trimmedFraction.length > 0 ? `.${trimmedFraction}` : ""}`;
}

export function displayDuration(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  return `${Math.round(seconds / 60)}m`;
}

export function explorerTransactionUrl(hash: string): string {
  return `https://explorer.testnet.arc.io/tx/${hash}`;
}
