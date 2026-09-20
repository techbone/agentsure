import { fileURLToPath } from "node:url";
import { getAddress, type Address } from "viem";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export type TestnetLifecycleConfig = {
  adminKeystore: string;
  agentWallet: Address;
  castBinary: string;
  circleBinary: string;
  durationSeconds: bigint;
  guardianAddress: Address;
  guardianHealthUrl: string;
  guardianKeystoreAccount: string;
  lossAssets: bigint;
  lossLimitBps: number;
  managerAddress: Address;
  minimumShares: bigint;
  outputPath: string;
  principalAssets: bigint;
  repositoryRoot: string;
  rpcUrl: string;
  usdcAddress: Address;
  vaultAddress: Address;
};

export function loadTestnetLifecycleConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TestnetLifecycleConfig {
  return {
    adminKeystore:
      environment.AGENTSURE_ADMIN_KEYSTORE ??
      `${repositoryRoot}packages/contracts/keystores/agentsure-testnet-deployer`,
    agentWallet: getAddress(
      environment.AGENTSURE_AGENT_WALLET ?? "0x218b80d3bCDaB79C66ee24AA15A3c8e2527f5E21",
    ),
    castBinary: environment.ARC_CAST_BINARY ?? `${repositoryRoot}.tools/arc-foundry/v0.8.0-1/cast`,
    circleBinary:
      environment.CIRCLE_BINARY ??
      `${repositoryRoot}.tools/circle-cli-1.1.3/node_modules/.bin/circle`,
    durationSeconds: 86_400n,
    guardianAddress: getAddress(
      environment.GUARDIAN_EXPECTED_ADDRESS ?? "0x8125e77Ef9A7db6Ac0ae13a9139C08044C702523",
    ),
    guardianHealthUrl: environment.GUARDIAN_HEALTH_URL ?? "http://127.0.0.1:9464/readyz",
    guardianKeystoreAccount: environment.GUARDIAN_KEYSTORE_ACCOUNT ?? "agentsure-testnet-guardian",
    lossAssets: 32_500n,
    lossLimitBps: 300,
    managerAddress: getAddress(
      environment.GUARDIAN_MANAGER_ADDRESS ?? "0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5",
    ),
    minimumShares: 990_000n,
    outputPath: environment.AGENTSURE_E2E_OUTPUT ?? `${repositoryRoot}.data/testnet-lifecycle.json`,
    principalAssets: 1_000_000n,
    repositoryRoot,
    rpcUrl: environment.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.io",
    usdcAddress: getAddress("0x3600000000000000000000000000000000000000"),
    vaultAddress: getAddress(
      environment.NEXT_PUBLIC_DEMO_RISK_VAULT_ADDRESS ??
        "0xa70344cEeA5598B836B148B0d83b19eE988b4599",
    ),
  };
}
