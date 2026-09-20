import { getAddress, type Address, type Hex } from "viem";
import { z } from "zod";

const integerString = z.string().regex(/^\d+$/);
const privateKeySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addressSchema = z.string().transform((value, context) => {
  try {
    return getAddress(value);
  } catch {
    context.addIssue({ code: "custom", message: "must be a valid EVM address" });
    return z.NEVER;
  }
});

const environmentSchema = z.object({
  ARC_MAINNET_RPC_URL: z.url().default("https://rpc.mainnet.arc.io"),
  ARC_TESTNET_RPC_URL: z.url().default("https://rpc.testnet.arc.io"),
  GUARDIAN_BIND_HOST: z.string().min(1).default("127.0.0.1"),
  GUARDIAN_BLOCK_BATCH_SIZE: integerString.default("2000").transform(Number),
  GUARDIAN_CHAIN_ID: z.enum(["5042", "5042002"]).default("5042002").transform(Number),
  GUARDIAN_EXIT_SLIPPAGE_BPS: integerString.default("100").transform(Number),
  GUARDIAN_HTTP_PORT: integerString.default("9464").transform(Number),
  GUARDIAN_MANAGER_ADDRESS: addressSchema,
  GUARDIAN_POLL_INTERVAL_MS: integerString.default("1000").transform(Number),
  GUARDIAN_PRIVATE_KEY: privateKeySchema,
  GUARDIAN_RETRY_ATTEMPTS: integerString.default("3").transform(Number),
  GUARDIAN_RETRY_BASE_DELAY_MS: integerString.default("250").transform(Number),
  GUARDIAN_START_BLOCK: integerString.transform(BigInt),
  GUARDIAN_STATE_PATH: z.string().min(1).default(".data/guardian-state.json"),
});

export type GuardianConfig = {
  bindHost: string;
  blockBatchSize: bigint;
  chainId: 5_042 | 5_042_002;
  exitSlippageBps: number;
  httpPort: number;
  managerAddress: Address;
  pollIntervalMs: number;
  privateKey: Hex;
  retryAttempts: number;
  retryBaseDelayMs: number;
  rpcUrl: string;
  startBlock: bigint;
  statePath: string;
};

export function loadGuardianConfig(environment: NodeJS.ProcessEnv = process.env): GuardianConfig {
  const parsed = environmentSchema.parse(environment);

  if (parsed.GUARDIAN_EXIT_SLIPPAGE_BPS > 500) {
    throw new RangeError("GUARDIAN_EXIT_SLIPPAGE_BPS must not exceed 500");
  }
  if (parsed.GUARDIAN_BLOCK_BATCH_SIZE < 1 || parsed.GUARDIAN_BLOCK_BATCH_SIZE > 10_000) {
    throw new RangeError("GUARDIAN_BLOCK_BATCH_SIZE must be between 1 and 10000");
  }
  if (parsed.GUARDIAN_RETRY_ATTEMPTS < 1 || parsed.GUARDIAN_RETRY_ATTEMPTS > 10) {
    throw new RangeError("GUARDIAN_RETRY_ATTEMPTS must be between 1 and 10");
  }
  if (parsed.GUARDIAN_HTTP_PORT < 1 || parsed.GUARDIAN_HTTP_PORT > 65_535) {
    throw new RangeError("GUARDIAN_HTTP_PORT must be a valid TCP port");
  }

  return {
    bindHost: parsed.GUARDIAN_BIND_HOST,
    blockBatchSize: BigInt(parsed.GUARDIAN_BLOCK_BATCH_SIZE),
    chainId: parsed.GUARDIAN_CHAIN_ID as 5_042 | 5_042_002,
    exitSlippageBps: parsed.GUARDIAN_EXIT_SLIPPAGE_BPS,
    httpPort: parsed.GUARDIAN_HTTP_PORT,
    managerAddress: parsed.GUARDIAN_MANAGER_ADDRESS,
    pollIntervalMs: parsed.GUARDIAN_POLL_INTERVAL_MS,
    privateKey: parsed.GUARDIAN_PRIVATE_KEY as Hex,
    retryAttempts: parsed.GUARDIAN_RETRY_ATTEMPTS,
    retryBaseDelayMs: parsed.GUARDIAN_RETRY_BASE_DELAY_MS,
    rpcUrl:
      parsed.GUARDIAN_CHAIN_ID === 5_042 ? parsed.ARC_MAINNET_RPC_URL : parsed.ARC_TESTNET_RPC_URL,
    startBlock: parsed.GUARDIAN_START_BLOCK,
    statePath: parsed.GUARDIAN_STATE_PATH,
  };
}
