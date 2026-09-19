import { describe, expect, it } from "vitest";
import { policyIntentSchema } from "./policy.js";

const validIntent = {
  amountUsdc: "1.00",
  beneficiary: "0x0000000000000000000000000000000000000001",
  durationSeconds: 24 * 60 * 60,
  maxLossBps: 300,
  vault: "0x0000000000000000000000000000000000000002",
};

describe("policy intent", () => {
  it("accepts a bounded policy", () => {
    expect(policyIntentSchema.parse(validIntent)).toEqual(validIntent);
  });

  it("rejects excessive precision", () => {
    expect(() => policyIntentSchema.parse({ ...validIntent, amountUsdc: "1.0000001" })).toThrow();
  });

  it("rejects an excessive protection duration", () => {
    expect(() =>
      policyIntentSchema.parse({ ...validIntent, durationSeconds: 31 * 24 * 60 * 60 }),
    ).toThrow();
  });

  it("rejects an invalid beneficiary", () => {
    expect(() =>
      policyIntentSchema.parse({ ...validIntent, beneficiary: "not-an-address" }),
    ).toThrow();
  });
});
