import { describe, expect, it } from "vitest";
import { assertPolicyExists, PolicyNotFoundError, toPolicyView } from "./policy-read-model.js";

const ADDRESS = "0x218b80d3bCDaB79C66ee24AA15A3c8e2527f5E21";
const VAULT = "0xa70344cEeA5598B836B148B0d83b19eE988b4599";

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
      63_229_388n,
    );

    expect(view.status).toBe("Executed");
    expect(view.assetsReturned).toBe("967500");
    expect(view.observedBlock).toBe("63229388");
    expect(JSON.stringify(view)).not.toContain("bigint");
  });

  it("distinguishes a missing policy from an unavailable Arc read", () => {
    expect(() => assertPolicyExists(2n, 2n)).toThrow(PolicyNotFoundError);
    expect(() => assertPolicyExists(1n, 2n)).not.toThrow();
  });
});
