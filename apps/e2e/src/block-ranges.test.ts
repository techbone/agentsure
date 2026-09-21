import { describe, expect, it } from "vitest";
import { reverseBlockRanges } from "./block-ranges.js";

describe("reverse block ranges", () => {
  it("searches recent blocks first without exceeding the RPC range limit", () => {
    expect(reverseBlockRanges(10n, 15n, 2n)).toEqual([
      { fromBlock: 14n, toBlock: 15n },
      { fromBlock: 12n, toBlock: 13n },
      { fromBlock: 10n, toBlock: 11n },
    ]);
  });

  it("returns one partial range at the lower boundary", () => {
    expect(reverseBlockRanges(10n, 12n, 2n)).toEqual([
      { fromBlock: 11n, toBlock: 12n },
      { fromBlock: 10n, toBlock: 10n },
    ]);
  });

  it("rejects an invalid range size", () => {
    expect(() => reverseBlockRanges(10n, 12n, 0n)).toThrow("must be positive");
  });
});
