import { fileURLToPath } from "node:url";
import { getAddress, type Address, type Chain } from "viem";
import { arc, arcTestnet } from "viem/chains";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export type LifecycleConfig = {
  adminKeystore: string;
  agentWallet: Address;
  castBinary: string;
  chain: Chain;
  circleBinary: string;
  circleChain: "ARC" | "ARC-TESTNET";
  deploymentBlock: bigint;
  durationSeconds: bigint;
  guardianAddress: Address;
  guardianHealthUrl: string;
  guardianKeystoreAccount: string;
  guardianMinimumBalanceAssets: bigint;
  guardianStatePath: string;
  lossAssets: bigint;
  lossLimitBps: number;
  lossSinkAddress: Address;
  managerAddress: Address;
  minimumShares: bigint;
  network: "Arc" | "Arc Testnet";
  outputPath: string;
  principalAssets: bigint;
  repositoryRoot: string;
  rpcEnvironmentKey: "ARC_MAINNET_RPC_URL" | "ARC_TESTNET_RPC_URL";
  rpcUrl: string;
  treasuryAddress: Address;
  usdcAddress: Address;
  vaultAddress: Address;
};

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key];
  if (value === undefined || value.length === 0) {
    throw new Error(`${key} is required for the Arc Mainnet lifecycle`);
  }
  return value;
}

export function loadLifecycleConfig(environment: NodeJS.ProcessEnv = process.env): LifecycleConfig {
  const isMainnet = environment.AGENTSURE_E2E_NETWORK === "mainnet";
  if (isMainnet && environment.AGENTSURE_E2E_ACKNOWLEDGE_MAINNET !== "I_UNDERSTAND") {
    throw new Error(
      "Set AGENTSURE_E2E_ACKNOWLEDGE_MAINNET=I_UNDERSTAND to authorize the real-USDC lifecycle",
    );
  }

  const managerAddress = isMainnet
    ? required(environment, "GUARDIAN_MANAGER_ADDRESS")
    : (environment.GUARDIAN_MANAGER_ADDRESS ?? "0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5");
  const vaultAddress = isMainnet
    ? required(environment, "NEXT_PUBLIC_DEMO_RISK_VAULT_ADDRESS")
    : (environment.NEXT_PUBLIC_DEMO_RISK_VAULT_ADDRESS ??
      "0xa70344cEeA5598B836B148B0d83b19eE988b4599");
  const agentWallet = isMainnet
    ? required(environment, "AGENTSURE_AGENT_WALLET")
    : (environment.AGENTSURE_AGENT_WALLET ?? "0x218b80d3bCDaB79C66ee24AA15A3c8e2527f5E21");
  const guardianAddress = isMainnet
    ? required(environment, "GUARDIAN_EXPECTED_ADDRESS")
    : (environment.GUARDIAN_EXPECTED_ADDRESS ?? "0x8125e77Ef9A7db6Ac0ae13a9139C08044C702523");
  const deploymentBlock = isMainnet
    ? BigInt(required(environment, "GUARDIAN_START_BLOCK"))
    : BigInt(environment.GUARDIAN_START_BLOCK ?? "63052386");
  const rpcEnvironmentKey = isMainnet ? "ARC_MAINNET_RPC_URL" : "ARC_TESTNET_RPC_URL";

  return {
    adminKeystore:
      environment.AGENTSURE_ADMIN_KEYSTORE ??
      `${repositoryRoot}packages/contracts/keystores/agentsure-testnet-deployer`,
    agentWallet: getAddress(agentWallet),
    castBinary: environment.ARC_CAST_BINARY ?? `${repositoryRoot}.tools/arc-foundry/v0.8.0-1/cast`,
    chain: isMainnet ? arc : arcTestnet,
    circleBinary:
      environment.CIRCLE_BINARY ??
      `${repositoryRoot}.tools/circle-cli-1.1.4/node_modules/.bin/circle`,
    circleChain: isMainnet ? "ARC" : "ARC-TESTNET",
    deploymentBlock,
    durationSeconds: 86_400n,
    guardianAddress: getAddress(guardianAddress),
    guardianHealthUrl: environment.GUARDIAN_HEALTH_URL ?? "http://127.0.0.1:9464/readyz",
    guardianKeystoreAccount:
      environment.GUARDIAN_KEYSTORE_ACCOUNT ??
      (isMainnet ? "agentsure-mainnet-guardian" : "agentsure-testnet-guardian"),
    guardianMinimumBalanceAssets: isMainnet ? 10_000n : 100_000n,
    guardianStatePath: isMainnet
      ? ".data/guardian-mainnet-state.json"
      : ".data/guardian-state.json",
    lossAssets: 32_500n,
    lossLimitBps: 300,
    lossSinkAddress: getAddress(
      environment.AGENTSURE_LOSS_SINK ?? "0x000000000000000000000000000000000000dEaD",
    ),
    managerAddress: getAddress(managerAddress),
    minimumShares: 990_000n,
    network: isMainnet ? "Arc" : "Arc Testnet",
    outputPath:
      environment.AGENTSURE_E2E_OUTPUT ??
      `${repositoryRoot}.data/${isMainnet ? "mainnet" : "testnet"}-lifecycle.json`,
    principalAssets: 1_000_000n,
    repositoryRoot,
    rpcEnvironmentKey,
    rpcUrl:
      environment[rpcEnvironmentKey] ??
      (isMainnet ? "https://rpc.mainnet.arc.io" : "https://rpc.testnet.arc.io"),
    treasuryAddress: getAddress(
      environment.AGENTSURE_TREASURY ?? "0x7602fB6EB360f28d9DE0e5adA6F8576A1f2CaEd5",
    ),
    usdcAddress: getAddress("0x3600000000000000000000000000000000000000"),
    vaultAddress: getAddress(vaultAddress),
  };
}

export function loadTestnetLifecycleConfig(
  environment: NodeJS.ProcessEnv = process.env,
): LifecycleConfig {
  return loadLifecycleConfig({ ...environment, AGENTSURE_E2E_NETWORK: "testnet" });
}
