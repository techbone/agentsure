import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { demoRiskVaultAbi, protectionManagerAbi } from "@agentsure/chain";
import {
  createPublicClient,
  decodeEventLog,
  erc20Abi,
  getAbiItem,
  getAddress,
  http,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { arcTestnet } from "viem/chains";
import { loadTestnetLifecycleConfig } from "./config.js";
import { requireTransactionHash, serializeEvidence } from "./evidence.js";
import { runCaptured, spawnGuardian, stopProcess } from "./process.js";

const PROTECTION_FEE_ASSETS = 10_000n;
const MANAGER_DEPLOYMENT_BLOCK = 63_052_386n;
const TREASURY_ADDRESS = getAddress("0x7602fB6EB360f28d9DE0e5adA6F8576A1f2CaEd5");
const LOSS_SINK_ADDRESS = getAddress("0x000000000000000000000000000000000000dEaD");

async function waitForGuardian(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The guardian may still be decrypting its keystore or backfilling finalized blocks.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Guardian did not become ready within ${timeoutMs}ms`);
}

async function writeEvidence(path: string, evidence: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, path);
}

async function main(): Promise<void> {
  const config = loadTestnetLifecycleConfig();
  const client = createPublicClient({ chain: arcTestnet, transport: http(config.rpcUrl) });
  const balanceOf = (address: Address, blockNumber?: bigint) =>
    client.readContract({
      address: config.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
      ...(blockNumber === undefined ? {} : { blockNumber }),
    });

  const [
    nextPolicyId,
    walletBalanceCurrent,
    keeperBalanceCurrent,
    treasuryBalanceCurrent,
    lossSinkBalanceCurrent,
    vaultAssetsCurrent,
  ] = await Promise.all([
    client.readContract({
      address: config.managerAddress,
      abi: protectionManagerAbi,
      functionName: "nextPolicyId",
    }),
    balanceOf(config.agentWallet),
    balanceOf(config.guardianAddress),
    balanceOf(TREASURY_ADDRESS),
    balanceOf(LOSS_SINK_ADDRESS),
    client.readContract({
      address: config.vaultAddress,
      abi: demoRiskVaultAbi,
      functionName: "totalAssets",
    }),
  ]);

  if (keeperBalanceCurrent < 100_000n) {
    throw new Error("Guardian needs at least 0.1 testnet USDC for execution gas");
  }

  let resumablePolicyId: bigint | null = null;
  for (let existingPolicyId = 1n; existingPolicyId < nextPolicyId; existingPolicyId += 1n) {
    const existingPolicy = await client.readContract({
      address: config.managerAddress,
      abi: protectionManagerAbi,
      functionName: "getPolicy",
      args: [existingPolicyId],
    });
    if (existingPolicy.status === 0 && getAddress(existingPolicy.owner) === config.agentWallet) {
      if (resumablePolicyId !== null) {
        throw new Error("Agent Wallet has multiple active policies; refusing an ambiguous resume");
      }
      if (
        getAddress(existingPolicy.beneficiary) !== config.agentWallet ||
        getAddress(existingPolicy.vault) !== config.vaultAddress ||
        existingPolicy.principalAssets !== config.principalAssets ||
        existingPolicy.lossLimitBps !== config.lossLimitBps
      ) {
        throw new Error(`Active policy ${existingPolicyId} does not match the demonstration terms`);
      }
      resumablePolicyId = existingPolicyId;
    }
  }

  if (resumablePolicyId === null) {
    if (walletBalanceCurrent < config.principalAssets + PROTECTION_FEE_ASSETS) {
      throw new Error("Agent Wallet does not have enough USDC for principal and protection fee");
    }
    if (vaultAssetsCurrent !== 0n) {
      throw new Error("Demo vault must be empty before starting a deterministic lifecycle run");
    }
  } else if (vaultAssetsCurrent !== config.principalAssets) {
    throw new Error("Resumable policy value changed before the controlled-loss step");
  }

  console.log(
    resumablePolicyId === null
      ? "Preflight passed. Starting a new protected lifecycle."
      : `Preflight passed. Resuming active policy #${resumablePolicyId} without another fee.`,
  );
  console.log("Enter the guardian keystore password when prompted (input stays invisible).");
  const guardian = spawnGuardian({
    cwd: config.repositoryRoot,
    environment: {
      ...process.env,
      ARC_TESTNET_RPC_URL: config.rpcUrl,
      GUARDIAN_CHAIN_ID: "5042002",
      GUARDIAN_EXPECTED_ADDRESS: config.guardianAddress,
      GUARDIAN_KEYSTORE_ACCOUNT: config.guardianKeystoreAccount,
      GUARDIAN_MANAGER_ADDRESS: config.managerAddress,
      GUARDIAN_START_BLOCK: "63052386",
      GUARDIAN_STATE_PATH: ".data/guardian-state.json",
    },
  });

  try {
    await waitForGuardian(config.guardianHealthUrl, 90_000);
    let policyId: bigint;
    let approvalTransactionHash: Hash;
    let approvalReceipt: TransactionReceipt;
    let openTransactionHash: Hash;
    let openReceipt: TransactionReceipt;
    let walletBalanceBefore: bigint;
    let keeperBalanceBefore: bigint;
    let treasuryBalanceBefore: bigint;
    let lossSinkBalanceBefore: bigint;
    let walletBalanceAfterOpen: bigint;
    let treasuryBalanceAfterOpen: bigint;

    if (resumablePolicyId === null) {
      policyId = nextPolicyId;
      walletBalanceBefore = walletBalanceCurrent;
      keeperBalanceBefore = keeperBalanceCurrent;
      treasuryBalanceBefore = treasuryBalanceCurrent;
      lossSinkBalanceBefore = lossSinkBalanceCurrent;

      console.log("Guardian is ready. Submitting exact Circle Agent Wallet approval.");
      const approvalOutput = await runCaptured(
        config.circleBinary,
        [
          "wallet",
          "execute",
          "approve(address,uint256)",
          config.managerAddress,
          (config.principalAssets + PROTECTION_FEE_ASSETS).toString(),
          "--contract",
          config.usdcAddress,
          "--address",
          config.agentWallet,
          "--chain",
          "ARC-TESTNET",
          "--output",
          "json",
        ],
        { cwd: config.repositoryRoot },
      );
      approvalTransactionHash = requireTransactionHash(approvalOutput, "USDC approval");
      approvalReceipt = await client.waitForTransactionReceipt({ hash: approvalTransactionHash });
      if (approvalReceipt.status !== "success") throw new Error("USDC approval reverted");

      console.log("Approval finalized. Opening the 1 USDC protection policy.");
      const openOutput = await runCaptured(
        config.circleBinary,
        [
          "wallet",
          "execute",
          "openPolicy(address,address,uint256,uint16,uint64,uint256)",
          config.vaultAddress,
          config.agentWallet,
          config.principalAssets.toString(),
          config.lossLimitBps.toString(),
          config.durationSeconds.toString(),
          config.minimumShares.toString(),
          "--contract",
          config.managerAddress,
          "--address",
          config.agentWallet,
          "--chain",
          "ARC-TESTNET",
          "--output",
          "json",
        ],
        { cwd: config.repositoryRoot },
      );
      openTransactionHash = requireTransactionHash(openOutput, "Policy opening");
      openReceipt = await client.waitForTransactionReceipt({ hash: openTransactionHash });
      if (openReceipt.status !== "success") throw new Error("Policy opening reverted");
      [walletBalanceAfterOpen, treasuryBalanceAfterOpen] = await Promise.all([
        balanceOf(config.agentWallet),
        balanceOf(TREASURY_ADDRESS),
      ]);
    } else {
      policyId = resumablePolicyId;
      console.log(`Guardian is ready. Recovering the onchain proof for policy #${policyId}.`);
      const openedEvent = getAbiItem({ abi: protectionManagerAbi, name: "PolicyOpened" });
      const openedLogs = await client.getLogs({
        address: config.managerAddress,
        event: openedEvent,
        args: { policyId },
        fromBlock: MANAGER_DEPLOYMENT_BLOCK,
        toBlock: "latest",
        strict: true,
      });
      const openedLog = openedLogs.at(-1);
      if (openedLog?.transactionHash === null || openedLog?.transactionHash === undefined) {
        throw new Error(`PolicyOpened proof was not found for policy ${policyId}`);
      }
      openTransactionHash = openedLog.transactionHash;
      openReceipt = await client.getTransactionReceipt({ hash: openTransactionHash });

      const approvalEvent = getAbiItem({ abi: erc20Abi, name: "Approval" });
      const approvalLogs = await client.getLogs({
        address: config.usdcAddress,
        event: approvalEvent,
        args: { owner: config.agentWallet, spender: config.managerAddress },
        fromBlock: openReceipt.blockNumber > 2_000n ? openReceipt.blockNumber - 2_000n : 0n,
        toBlock: openReceipt.blockNumber,
        strict: true,
      });
      const approvalLog = approvalLogs
        .filter((log) => log.args.value === config.principalAssets + PROTECTION_FEE_ASSETS)
        .at(-1);
      if (approvalLog?.transactionHash === null || approvalLog?.transactionHash === undefined) {
        throw new Error(`USDC approval proof was not found for policy ${policyId}`);
      }
      approvalTransactionHash = approvalLog.transactionHash;
      approvalReceipt = await client.getTransactionReceipt({ hash: approvalTransactionHash });

      const beforeOpenBlock = openReceipt.blockNumber - 1n;
      [
        walletBalanceBefore,
        keeperBalanceBefore,
        treasuryBalanceBefore,
        lossSinkBalanceBefore,
        walletBalanceAfterOpen,
        treasuryBalanceAfterOpen,
      ] = await Promise.all([
        balanceOf(config.agentWallet, beforeOpenBlock),
        balanceOf(config.guardianAddress, beforeOpenBlock),
        balanceOf(TREASURY_ADDRESS, beforeOpenBlock),
        balanceOf(LOSS_SINK_ADDRESS, beforeOpenBlock),
        balanceOf(config.agentWallet, openReceipt.blockNumber),
        balanceOf(TREASURY_ADDRESS, openReceipt.blockNumber),
      ]);
      console.log(`Recovered approval and opening proofs. Continuing policy #${policyId}.`);
    }

    const policyBeforeLoss = await client.readContract({
      address: config.managerAddress,
      abi: protectionManagerAbi,
      functionName: "getPolicy",
      args: [policyId],
    });
    if (
      getAddress(policyBeforeLoss.owner) !== config.agentWallet ||
      getAddress(policyBeforeLoss.beneficiary) !== config.agentWallet ||
      policyBeforeLoss.status !== 0
    ) {
      throw new Error("Opened policy terms do not match the Circle Agent Wallet intent");
    }

    if (
      walletBalanceBefore - walletBalanceAfterOpen !==
      config.principalAssets + PROTECTION_FEE_ASSETS
    ) {
      throw new Error("Agent Wallet debit does not equal principal plus protection fee");
    }
    if (treasuryBalanceAfterOpen - treasuryBalanceBefore !== PROTECTION_FEE_ASSETS) {
      throw new Error("Treasury did not receive the declared protection fee");
    }

    console.log(
      "Policy is active. Enter the DEPLOYER keystore password now (input stays invisible).",
    );
    const lossOutput = await runCaptured(
      config.castBinary,
      [
        "send",
        config.vaultAddress,
        "simulateLoss(uint256)",
        config.lossAssets.toString(),
        "--rpc-url",
        config.rpcUrl,
        "--keystore",
        config.adminKeystore,
        "--json",
      ],
      { cwd: config.repositoryRoot },
    );
    const lossTransactionHash = requireTransactionHash(lossOutput, "Demo loss");
    const lossReceipt = await client.waitForTransactionReceipt({ hash: lossTransactionHash });
    if (lossReceipt.status !== "success") throw new Error("Demo loss transaction reverted");

    const lossLog = lossReceipt.logs
      .filter((log) => getAddress(log.address) === config.vaultAddress)
      .map((log) => {
        try {
          return decodeEventLog({
            abi: demoRiskVaultAbi,
            data: log.data,
            topics: log.topics,
            strict: true,
          });
        } catch {
          return null;
        }
      })
      .find((log) => log?.eventName === "DemoLossSimulated");
    if (lossLog === undefined || lossLog === null || lossLog.eventName !== "DemoLossSimulated") {
      throw new Error("DemoLossSimulated event was not found");
    }
    const valueAfterLoss = lossLog.args.totalAssetsAfter;
    if (valueAfterLoss > policyBeforeLoss.triggerAssets) {
      throw new Error("Controlled loss did not breach the configured protection trigger");
    }

    console.log("Loss is finalized and the trigger is breached. Waiting for AgentSure execution.");
    const executionDeadline = Date.now() + 90_000;
    let policyAfterExecution = policyBeforeLoss;
    while (Date.now() < executionDeadline) {
      policyAfterExecution = await client.readContract({
        address: config.managerAddress,
        abi: protectionManagerAbi,
        functionName: "getPolicy",
        args: [policyId],
      });
      if (policyAfterExecution.status === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (policyAfterExecution.status !== 1) {
      throw new Error("Guardian did not execute the breached policy within 90 seconds");
    }

    const executionEvent = getAbiItem({ abi: protectionManagerAbi, name: "ProtectionExecuted" });
    const executionLogs = await client.getLogs({
      address: config.managerAddress,
      event: executionEvent,
      args: { policyId },
      fromBlock: openReceipt.blockNumber,
      toBlock: "latest",
      strict: true,
    });
    const executionLog = executionLogs.at(-1);
    if (executionLog?.transactionHash === null || executionLog?.transactionHash === undefined) {
      throw new Error("ProtectionExecuted event was not found");
    }
    if (getAddress(executionLog.args.executor) !== config.guardianAddress) {
      throw new Error("Protection was not executed by the dedicated guardian");
    }
    const executionReceipt = await client.getTransactionReceipt({
      hash: executionLog.transactionHash,
    });

    const [walletBalanceAfter, keeperBalanceAfter, lossSinkBalanceAfter, vaultAssetsAfter] =
      await Promise.all([
        balanceOf(config.agentWallet),
        balanceOf(config.guardianAddress),
        balanceOf(LOSS_SINK_ADDRESS),
        client.readContract({
          address: config.vaultAddress,
          abi: demoRiskVaultAbi,
          functionName: "totalAssets",
        }),
      ]);

    if (policyAfterExecution.assetsReturned !== valueAfterLoss) {
      throw new Error("Recorded settlement does not match the breached position value");
    }
    if (lossSinkBalanceAfter - lossSinkBalanceBefore !== config.lossAssets) {
      throw new Error("Loss sink did not receive the declared controlled-loss amount");
    }
    if (vaultAssetsAfter !== 0n) {
      throw new Error("Demo vault retained assets after full policy execution");
    }
    if (walletBalanceAfter - walletBalanceAfterOpen !== policyAfterExecution.assetsReturned) {
      throw new Error("Circle Agent Wallet did not receive the recorded settlement amount");
    }

    const evidence = serializeEvidence({
      schemaVersion: 1,
      network: "Arc Testnet",
      chainId: arcTestnet.id,
      completedAt: new Date().toISOString(),
      participants: {
        circleAgentWallet: config.agentWallet,
        guardian: config.guardianAddress,
        treasury: TREASURY_ADDRESS,
        lossSink: LOSS_SINK_ADDRESS,
      },
      contracts: {
        usdc: config.usdcAddress,
        protectionManager: config.managerAddress,
        demoRiskVault: config.vaultAddress,
      },
      policy: {
        policyId,
        principalAssets: config.principalAssets,
        protectionFeeAssets: PROTECTION_FEE_ASSETS,
        lossLimitBps: config.lossLimitBps,
        triggerAssets: policyBeforeLoss.triggerAssets,
        controlledLossAssets: config.lossAssets,
        valueAfterLoss,
        assetsReturned: policyAfterExecution.assetsReturned,
        status: "Executed",
      },
      transactions: {
        approval: {
          hash: approvalTransactionHash,
          blockNumber: approvalReceipt.blockNumber,
          blockHash: approvalReceipt.blockHash,
        },
        policyOpened: {
          hash: openTransactionHash,
          blockNumber: openReceipt.blockNumber,
          blockHash: openReceipt.blockHash,
        },
        controlledLoss: {
          hash: lossTransactionHash,
          blockNumber: lossReceipt.blockNumber,
          blockHash: lossReceipt.blockHash,
        },
        protectionExecuted: {
          hash: executionLog.transactionHash,
          blockNumber: executionReceipt.blockNumber,
          blockHash: executionReceipt.blockHash,
        },
      },
      balances: {
        circleAgentWalletBefore: walletBalanceBefore,
        circleAgentWalletAfterOpen: walletBalanceAfterOpen,
        circleAgentWalletAfterSettlement: walletBalanceAfter,
        guardianBefore: keeperBalanceBefore,
        guardianAfter: keeperBalanceAfter,
        treasuryBefore: treasuryBalanceBefore,
        treasuryAfterOpen: treasuryBalanceAfterOpen,
        lossSinkBefore: lossSinkBalanceBefore,
        lossSinkAfter: lossSinkBalanceAfter,
      },
      verified: {
        ownerIsCircleAgentWallet: true,
        beneficiaryIsCircleAgentWallet: true,
        executorIsDedicatedGuardian: true,
        protectionFeeReachedTreasury: true,
        triggerWasBreached: true,
        settlementMatchedPositionValue: true,
        settlementReachedCircleAgentWallet: true,
        vaultWasEmptied: true,
      },
    });
    await writeEvidence(config.outputPath, evidence);

    console.log(`Lifecycle complete. Evidence written to ${config.outputPath}`);
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await stopProcess(guardian);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
