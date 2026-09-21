import deploymentManifest from "../../../../../../../packages/contracts/deployments/arc-testnet.json";
import lifecycleProof from "../../../../../../../docs/evidence/arc-testnet-lifecycle.json";
import { demoRiskVaultAbi } from "@agentsure/chain/demo-risk-vault";
import { protectionManagerAbi } from "@agentsure/chain/protection-manager";
import { parseUsdc } from "@agentsure/domain/money";
import { policyIntentSchema } from "@agentsure/domain/policy";
import { NextResponse } from "next/server";
import { createPublicClient, erc20Abi, getAddress, http, isAddressEqual, type Address } from "viem";
import { arcTestnet } from "viem/chains";
import { createPolicyExecutionPlan, PolicyPlanError } from "@/lib/policy-plan";

export const dynamic = "force-dynamic";

const managerAddress = getAddress(deploymentManifest.contracts.ProtectionManager.address);
const vaultAddress = getAddress(deploymentManifest.contracts.DemoRiskVault.address);
const usdcAddress = getAddress(
  deploymentManifest.contracts.ProtectionManager.configuration.assetToken,
);
const walletAddress = getAddress(lifecycleProof.participants.circleAgentWallet);

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = policyIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_POLICY_INTENT",
        message: parsed.error.issues[0]?.message ?? "Review the protection terms.",
      },
      { status: 400 },
    );
  }
  if (
    !isAddressEqual(getAddress(parsed.data.beneficiary), walletAddress) ||
    !isAddressEqual(getAddress(parsed.data.vault), vaultAddress)
  ) {
    return NextResponse.json(
      {
        code: "UNSUPPORTED_DEMO_TARGET",
        message: "Milestone 5 supports only the verified Agent Wallet and allowlisted demo vault.",
      },
      { status: 400 },
    );
  }

  try {
    const principalAssets = parseUsdc(parsed.data.amountUsdc);
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_TESTNET_RPC_URL ?? deploymentManifest.rpcUrl),
    });
    const managerCall = <TFunctionName extends ManagerReadFunction>(
      functionName: TFunctionName,
    ) => ({
      address: managerAddress,
      abi: protectionManagerAbi,
      functionName,
    });

    const [results, observedBlock] = await Promise.all([
      client.multicall({
        allowFailure: false,
        contracts: [
          managerCall("paused"),
          managerCall("assetToken"),
          managerCall("protectionFeeAssets"),
          managerCall("maxPrincipalAssets"),
          managerCall("minDuration"),
          managerCall("maxDuration"),
          managerCall("minLossLimitBps"),
          managerCall("maxLossLimitBps"),
          managerCall("nextPolicyId"),
          {
            address: managerAddress,
            abi: protectionManagerAbi,
            functionName: "isVaultAllowed",
            args: [vaultAddress],
          },
          {
            address: vaultAddress,
            abi: demoRiskVaultAbi,
            functionName: "previewDeposit",
            args: [principalAssets],
          },
          {
            address: vaultAddress,
            abi: demoRiskVaultAbi,
            functionName: "maxDeposit",
            args: [managerAddress],
          },
          {
            address: usdcAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress],
          },
        ] as const,
      }),
      client.getBlockNumber(),
    ]);

    const [
      paused,
      assetToken,
      protectionFeeAssets,
      maxPrincipalAssets,
      minDuration,
      maxDuration,
      minLossLimitBps,
      maxLossLimitBps,
      nextPolicyId,
      isVaultAllowed,
      previewShares,
      maxDepositAssets,
      walletBalanceAssets,
    ] = results;

    const plan = createPolicyExecutionPlan({
      deployment: {
        chainId: deploymentManifest.chainId,
        manager: managerAddress,
        network: deploymentManifest.network,
        usdc: usdcAddress,
        vault: vaultAddress,
        wallet: walletAddress,
      },
      intent: parsed.data,
      onchain: {
        assetToken: getAddress(assetToken as Address),
        isVaultAllowed: isVaultAllowed as boolean,
        maxDepositAssets: maxDepositAssets as bigint,
        maxDurationSeconds: maxDuration as bigint,
        maxLossLimitBps: maxLossLimitBps as number,
        maxPrincipalAssets: maxPrincipalAssets as bigint,
        minDurationSeconds: minDuration as bigint,
        minimumLossLimitBps: minLossLimitBps as number,
        nextPolicyId: nextPolicyId as bigint,
        observedBlock,
        paused: paused as boolean,
        previewShares: previewShares as bigint,
        protectionFeeAssets: protectionFeeAssets as bigint,
        walletBalanceAssets: walletBalanceAssets as bigint,
      },
    });

    return NextResponse.json(plan, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PolicyPlanError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        code: "ARC_PREFLIGHT_UNAVAILABLE",
        message: "Finalized Arc state could not be verified. No execution plan was produced.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

type ManagerReadFunction =
  | "assetToken"
  | "maxDuration"
  | "maxLossLimitBps"
  | "maxPrincipalAssets"
  | "minDuration"
  | "minLossLimitBps"
  | "nextPolicyId"
  | "paused"
  | "protectionFeeAssets";
