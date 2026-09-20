import { describe, expect, it } from "vitest";
import { JsonLogger } from "./logger.js";

describe("JSON logger", () => {
  it("serializes bigint fields and redacts signing material", () => {
    const lines: string[] = [];
    const logger = new JsonLogger((line) => lines.push(line));

    logger.info("keeper configured", {
      blockNumber: 42n,
      nested: { privateKey: "0xunsafe", seedPhrase: "unsafe words" },
    });

    expect(lines).toHaveLength(1);
    const log = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(log.blockNumber).toBe("42");
    expect(log).not.toEqual(expect.objectContaining({ privateKey: "0xunsafe" }));
    expect(lines[0]).not.toContain("0xunsafe");
    expect(lines[0]).not.toContain("unsafe words");
  });
});
