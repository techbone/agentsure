import { describe, expect, it } from "vitest";
import { requireTransactionHash, serializeEvidence } from "./evidence.js";

const HASH = `0x${"a".repeat(64)}`;

describe("lifecycle evidence", () => {
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
