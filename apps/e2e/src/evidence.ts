import type { Hash } from "viem";

const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function requireTransactionHash(output: string, label: string): Hash {
  const value = JSON.parse(output) as unknown;
  const visit = (candidate: unknown): Hash | null => {
    if (typeof candidate === "string" && TRANSACTION_HASH_PATTERN.test(candidate)) {
      return candidate as Hash;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const result = visit(item);
        if (result !== null) return result;
      }
    }
    if (candidate !== null && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      for (const key of ["txHash", "transactionHash"]) {
        const result = visit(record[key]);
        if (result !== null) return result;
      }
      for (const child of Object.values(record)) {
        const result = visit(child);
        if (result !== null) return result;
      }
    }
    return null;
  };

  const transactionHash = visit(value);
  if (transactionHash === null) {
    throw new Error(`${label} did not return a transaction hash`);
  }
  return transactionHash;
}

export function serializeEvidence(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeEvidence);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeEvidence(child)]),
    );
  }
  return value;
}
