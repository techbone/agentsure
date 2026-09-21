import { protectionManagerAbi } from "@agentsure/chain/protection-manager";
import {
  BPS_DENOMINATOR,
  calculateTriggerAssets,
  formatUsdc,
  parseUsdc,
} from "@agentsure/domain/money";
import type { PolicyIntent } from "@agentsure/domain/policy";
import {
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";

export const ENTRY_SLIPPAGE_BPS = 100n;

export class PolicyPlanError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PolicyPlanError";
    this.code = code;
  }
}

export type PolicyPlanDeployment = {
  chainId: number;
  manager: Address;
  network: string;
  usdc: Address;
  vault: Address;
  wallet: Address;
};

export type PolicyPlanOnchainState = {
  assetToken: Address;
  isVaultAllowed: boolean;
  maxDepositAssets: bigint;
  maxDurationSeconds: bigint;
  maxLossLimitBps: number;
  maxPrincipalAssets: bigint;
  minDurationSeconds: bigint;
  minimumLossLimitBps: number;
  nextPolicyId: bigint;
  observedBlock: bigint;
  paused: boolean;
  previewShares: bigint;
  protectionFeeAssets: bigint;
  walletBalanceAssets: bigint;
};

export type PolicyExecutionStep = {
  calldata: Hex;
  cliCommand: string;
  description: string;
  functionSignature: string;
  id: "approve" | "open-policy";
  target: Address;
};

export type PolicyExecutionPlan = {
  agentInstruction: string;
  deployment: PolicyPlanDeployment;
  intentId: Hex;
  policyNumberAtPreparation: string;
  schemaVersion: 1;
  source: {
    blockNumber: string;
    kind: "finalized-arc-state";
  };
  steps: [PolicyExecutionStep, PolicyExecutionStep];
  terms: {
    authorizationAssets: string;
    durationSeconds: number;
    entrySlippageBps: number;
    lossLimitBps: number;
    minimumShares: string;
    previewShares: string;
    principalAssets: string;
    protectionFeeAssets: string;
    triggerAssets: string;
  };
  wallet: {
    address: Address;
    balanceAssets: string;
    custody: "Circle Agent Wallet / 2-of-2 MPC";
  };
};

export function createPolicyExecutionPlan(options: {
  deployment: PolicyPlanDeployment;
  intent: PolicyIntent;
  onchain: PolicyPlanOnchainState;
}): PolicyExecutionPlan {
  const deployment = normalizeDeployment(options.deployment);
  const { intent, onchain } = options;
  const principalAssets = parseUsdc(intent.amountUsdc);
  const duration = BigInt(intent.durationSeconds);

  if (onchain.paused) {
    throw new PolicyPlanError("MANAGER_PAUSED", "New policies are currently paused onchain.");
  }
  if (getAddress(onchain.assetToken) !== deployment.usdc) {
    throw new PolicyPlanError(
      "ASSET_MISMATCH",
      "The deployed manager is not configured for the expected Arc USDC contract.",
    );
  }
  if (!onchain.isVaultAllowed) {
    throw new PolicyPlanError("VAULT_NOT_ALLOWED", "The selected vault is not allowed onchain.");
  }
  if (principalAssets > onchain.maxPrincipalAssets) {
    throw new PolicyPlanError(
      "PRINCIPAL_OUT_OF_BOUNDS",
      `Position size exceeds the onchain ${formatUsdc(onchain.maxPrincipalAssets)} USDC cap.`,
    );
  }
  if (duration < onchain.minDurationSeconds || duration > onchain.maxDurationSeconds) {
    throw new PolicyPlanError(
      "DURATION_OUT_OF_BOUNDS",
      "The protection window is outside the deployed contract bounds.",
    );
  }
  if (
    intent.maxLossBps < onchain.minimumLossLimitBps ||
    intent.maxLossBps > onchain.maxLossLimitBps
  ) {
    throw new PolicyPlanError(
      "LOSS_LIMIT_OUT_OF_BOUNDS",
      "The downside limit is outside the deployed contract bounds.",
    );
  }
  if (principalAssets > onchain.maxDepositAssets) {
    throw new PolicyPlanError(
      "VAULT_CAPACITY_EXCEEDED",
      "The demo vault does not currently have enough remaining deposit capacity.",
    );
  }
  if (onchain.previewShares <= 0n) {
    throw new PolicyPlanError(
      "INVALID_SHARE_PREVIEW",
      "The vault returned an invalid share quote.",
    );
  }

  const authorizationAssets = principalAssets + onchain.protectionFeeAssets;
  if (onchain.walletBalanceAssets < authorizationAssets) {
    throw new PolicyPlanError(
      "INSUFFICIENT_WALLET_BALANCE",
      `The Agent Wallet needs ${formatUsdc(authorizationAssets)} USDC but currently holds ${formatUsdc(onchain.walletBalanceAssets)} USDC.`,
    );
  }

  const minimumShares =
    (onchain.previewShares * (BPS_DENOMINATOR - ENTRY_SLIPPAGE_BPS)) / BPS_DENOMINATOR;
  if (minimumShares <= 0n) {
    throw new PolicyPlanError(
      "INVALID_MINIMUM_SHARES",
      "The entry slippage guard rounded to zero shares.",
    );
  }

  const approveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [deployment.manager, authorizationAssets],
  });
  const openPolicyCalldata = encodeFunctionData({
    abi: protectionManagerAbi,
    functionName: "openPolicy",
    args: [
      deployment.vault,
      getAddress(intent.beneficiary),
      principalAssets,
      intent.maxLossBps,
      duration,
      minimumShares,
    ],
  });

  const approveCommand = circleExecuteCommand({
    address: deployment.wallet,
    args: [deployment.manager, authorizationAssets.toString()],
    contract: deployment.usdc,
    signature: "approve(address,uint256)",
  });
  const openPolicyCommand = circleExecuteCommand({
    address: deployment.wallet,
    args: [
      deployment.vault,
      getAddress(intent.beneficiary),
      principalAssets.toString(),
      intent.maxLossBps.toString(),
      duration.toString(),
      minimumShares.toString(),
    ],
    contract: deployment.manager,
    signature: "openPolicy(address,address,uint256,uint16,uint64,uint256)",
  });

  const intentId = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "uint256 chainId, address wallet, address manager, address vault, address beneficiary, uint256 principalAssets, uint16 lossLimitBps, uint64 duration, uint256 minimumShares",
      ),
      [
        BigInt(deployment.chainId),
        deployment.wallet,
        deployment.manager,
        deployment.vault,
        getAddress(intent.beneficiary),
        principalAssets,
        intent.maxLossBps,
        duration,
        minimumShares,
      ],
    ),
  );

  const agentInstruction = [
    `Open an AgentSure policy on ${deployment.network} from Circle Agent Wallet ${deployment.wallet}.`,
    `The confirmed terms are ${formatUsdc(principalAssets)} USDC principal, ${intent.maxLossBps / 100}% maximum downside, and ${intent.durationSeconds} seconds.`,
    "Execute these commands in order and wait for each transaction to finalize:",
    `1. ${approveCommand}`,
    `2. ${openPolicyCommand}`,
    "Return both transaction hashes. Do not alter the targets, amounts, beneficiary, duration, downside limit, or minimum shares.",
  ].join("\n\n");

  return {
    agentInstruction,
    deployment,
    intentId,
    policyNumberAtPreparation: onchain.nextPolicyId.toString(),
    schemaVersion: 1,
    source: {
      blockNumber: onchain.observedBlock.toString(),
      kind: "finalized-arc-state",
    },
    steps: [
      {
        calldata: approveCalldata,
        cliCommand: approveCommand,
        description: `Authorize exactly ${formatUsdc(authorizationAssets)} USDC for principal and fee.`,
        functionSignature: "approve(address,uint256)",
        id: "approve",
        target: deployment.usdc,
      },
      {
        calldata: openPolicyCalldata,
        cliCommand: openPolicyCommand,
        description: `Open the bounded position with a ${formatUsdc(calculateTriggerAssets(principalAssets, intent.maxLossBps))} USDC trigger.`,
        functionSignature: "openPolicy(address,address,uint256,uint16,uint64,uint256)",
        id: "open-policy",
        target: deployment.manager,
      },
    ],
    terms: {
      authorizationAssets: authorizationAssets.toString(),
      durationSeconds: intent.durationSeconds,
      entrySlippageBps: Number(ENTRY_SLIPPAGE_BPS),
      lossLimitBps: intent.maxLossBps,
      minimumShares: minimumShares.toString(),
      previewShares: onchain.previewShares.toString(),
      principalAssets: principalAssets.toString(),
      protectionFeeAssets: onchain.protectionFeeAssets.toString(),
      triggerAssets: calculateTriggerAssets(principalAssets, intent.maxLossBps).toString(),
    },
    wallet: {
      address: deployment.wallet,
      balanceAssets: onchain.walletBalanceAssets.toString(),
      custody: "Circle Agent Wallet / 2-of-2 MPC",
    },
  };
}

function normalizeDeployment(deployment: PolicyPlanDeployment): PolicyPlanDeployment {
  return {
    ...deployment,
    manager: getAddress(deployment.manager),
    usdc: getAddress(deployment.usdc),
    vault: getAddress(deployment.vault),
    wallet: getAddress(deployment.wallet),
  };
}

function circleExecuteCommand(options: {
  address: Address;
  args: string[];
  contract: Address;
  signature: string;
}): string {
  return [
    "circle wallet execute",
    `"${options.signature}"`,
    ...options.args,
    "--contract",
    options.contract,
    "--address",
    options.address,
    "--chain ARC-TESTNET --output json",
  ].join(" ");
}
