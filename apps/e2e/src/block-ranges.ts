export type BlockRange = {
  fromBlock: bigint;
  toBlock: bigint;
};

export function reverseBlockRanges(
  minimumBlock: bigint,
  maximumBlock: bigint,
  maximumRangeSize: bigint,
): BlockRange[] {
  if (maximumRangeSize < 1n) throw new RangeError("maximumRangeSize must be positive");
  if (maximumBlock < minimumBlock) return [];

  const ranges: BlockRange[] = [];
  let toBlock = maximumBlock;
  while (toBlock >= minimumBlock) {
    const candidateFromBlock = toBlock - maximumRangeSize + 1n;
    const fromBlock = candidateFromBlock > minimumBlock ? candidateFromBlock : minimumBlock;
    ranges.push({ fromBlock, toBlock });
    if (fromBlock === minimumBlock) break;
    toBlock = fromBlock - 1n;
  }
  return ranges;
}
