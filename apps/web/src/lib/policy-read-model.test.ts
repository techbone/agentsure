import { describe, expect, it } from "vitest";
import { assertPolicyExists, PolicyNotFoundError, toPolicyView } from "./policy-read-model.js";

const ADDRESS = "0x6b9B032be42343944bd383Cc3f0a3e4C6120106f";
const VAULT = "0x09503c928c13ebc01EfB6fD291825020C5e876Ba";

describe("policy read model", () => {
  it("serializes authoritative onchain values for the browser", () => {
    const view = toPolicyView(
      1n,
      {
        owner: ADDRESS,
        beneficiary: ADDRESS,
        vault: VAULT,
        principalAssets: 1_000_000n,
        shares: 1_000_000n,
        triggerAssets: 970_000n,
        assetsReturned: 967_500n,
        openedAt: 1_000n,
        expiresAt: 2_000n,
        lossLimitBps: 300,
        status: 1,
      },
      967_500n,
      22_187_609n,
    );

    expect(view.status).toBe("Executed");
    expect(view.assetsReturned).toBe("967500");
    expect(view.observedBlock).toBe("22187609");
    expect(JSON.stringify(view)).not.toContain("bigint");
  });

  it("distinguishes a missing policy from an unavailable Arc read", () => {
    expect(() => assertPolicyExists(2n, 2n)).toThrow(PolicyNotFoundError);
    expect(() => assertPolicyExists(1n, 2n)).not.toThrow();
  });
});
