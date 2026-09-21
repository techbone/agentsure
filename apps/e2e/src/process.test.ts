import { describe, expect, it } from "vitest";
import { shouldForwardGuardianLine } from "./process.js";

describe("guardian lifecycle output", () => {
  it("suppresses repetitive debug monitoring lines", () => {
    expect(shouldForwardGuardianLine('{"level":"debug","message":"indexed"}')).toBe(false);
  });

  it("keeps operational and non-JSON output visible", () => {
    expect(shouldForwardGuardianLine('{"level":"info","message":"started"}')).toBe(true);
    expect(shouldForwardGuardianLine("Enter password:")).toBe(true);
  });
});
