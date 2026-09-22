import { describe, expect, it } from "vitest";
import { compactAddress, displayDuration, displayUsdc, explorerTransactionUrl } from "./display.js";

describe("web display helpers", () => {
  it("formats raw USDC without implying unsupported precision", () => {
    expect(displayUsdc("967500")).toBe("0.9675");
    expect(displayUsdc(1_000_000n)).toBe("1");
  });

  it("compacts addresses and humanizes policy durations", () => {
    expect(compactAddress("0x218b80d3bCDaB79C66ee24AA15A3c8e2527f5E21")).toBe("0x218b…5E21");
    expect(displayDuration(86_400)).toBe("1d");
    expect(displayDuration(3_600)).toBe("1h");
  });

  it("links lifecycle proofs to Arc Mainnet", () => {
    expect(explorerTransactionUrl(`0x${"a".repeat(64)}`)).toBe(
      `https://explorer.arc.io/tx/0x${"a".repeat(64)}`,
    );
  });
});
