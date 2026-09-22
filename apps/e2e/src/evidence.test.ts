import { describe, expect, it } from "vitest";
import {
  calculateWalletNetworkFees,
  requireTransactionHash,
  serializeEvidence,
} from "./evidence.js";

const HASH = `0x${"a".repeat(64)}`;

describe("lifecycle evidence", () => {
  it("separates protocol debit from Agent Wallet network fees", () => {
    expect(calculateWalletNetworkFees(1_070_000n, 10_000n, 1_000_000n, 10_000n)).toBe(50_000n);
  });

  it("rejects an underfunded protocol debit", () => {
    expect(() => calculateWalletNetworkFees(1_000_000n, 0n, 1_000_000n, 10_000n)).toThrow(
      "smaller than principal plus protection fee",
    );
  });

  it("extracts a nested Circle transaction hash", () => {
    expect(requireTransactionHash(JSON.stringify({ data: { txHash: HASH } }), "Circle")).toBe(HASH);
  });

  it("extracts a Foundry transaction hash", () => {
    expect(requireTransactionHash(JSON.stringify({ transactionHash: HASH }), "Foundry")).toBe(HASH);
  });

  it("rejects output without a transaction proof", () => {
    expect(() => requireTransactionHash('{"state":"COMPLETE"}', "Circle")).toThrow(
      "Circle did not return a transaction hash",
    );
  });

  it("serializes bigint evidence without losing precision", () => {
    expect(serializeEvidence({ amount: 1_000_000n, nested: [32_500n] })).toEqual({
      amount: "1000000",
      nested: ["32500"],
    });
  });
});
