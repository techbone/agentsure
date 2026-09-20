import { describe, expect, it } from "vitest";
import { extractPrivateKey } from "./keystore.js";

const KEY = `0x${"1".repeat(64)}`;

describe("Foundry keystore output", () => {
  it("extracts a labeled private key without retaining surrounding output", () => {
    expect(extractPrivateKey(`Private Key: ${KEY}\n`)).toBe(KEY);
  });

  it("rejects output without a complete private key", () => {
    expect(() => extractPrivateKey("Keystore decrypted")).toThrow(
      "did not return a valid private key",
    );
  });
});
