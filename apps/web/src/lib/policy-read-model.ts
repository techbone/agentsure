import { protectionManagerAbi } from "@agentsure/chain/protection-manager";
import { createPublicClient, getAddress, http, type Address } from "viem";
import { arc } from "viem/chains";

export const MAINNET_MANAGER_ADDRESS = getAddress("0xa70344cEeA5598B836B148B0d83b19eE988b4599");

const POLICY_STATUS = ["Active", "Executed", "Cancelled", "Expired"] as const;

export class PolicyNotFoundError extends Error {
  readonly policyId: bigint;

  constructor(policyId: bigint) {
    super(`Policy #${policyId} does not exist.`);
    this.name = "PolicyNotFoundError";
    this.policyId = policyId;
  }
}

type PolicyTuple = {
  owner: Address;
  beneficiary: Address;
  vault: Address;
  principalAssets: bigint;
  shares: bigint;
  triggerAssets: bigint;
  assetsReturned: bigint;
  openedAt: bigint;
  expiresAt: bigint;
  lossLimitBps: number;
  status: number;
};

export type PolicyView = {
  policyId: string;
  status: (typeof POLICY_STATUS)[number] | "Unknown";
  owner: Address;
  beneficiary: Address;
  vault: Address;
  principalAssets: string;
  currentAssets: string;
  triggerAssets: string;
  assetsReturned: string;
  lossLimitBps: number;
  openedAt: string;
  expiresAt: string;
  observedBlock: string;
  managerAddress: Address;
  network: "Arc";
};

export function assertPolicyExists(policyId: bigint, nextPolicyId: bigint): void {
  if (policyId < 1n || policyId >= nextPolicyId) {
    throw new PolicyNotFoundError(policyId);
  }
}

export function toPolicyView(
  policyId: bigint,
  policy: PolicyTuple,
  currentAssets: bigint,
  observedBlock: bigint,
): PolicyView {
  return {
    policyId: policyId.toString(),
    status: POLICY_STATUS[policy.status] ?? "Unknown",
    owner: getAddress(policy.owner),
    beneficiary: getAddress(policy.beneficiary),
    vault: getAddress(policy.vault),
    principalAssets: policy.principalAssets.toString(),
    currentAssets: currentAssets.toString(),
    triggerAssets: policy.triggerAssets.toString(),
    assetsReturned: policy.assetsReturned.toString(),
    lossLimitBps: policy.lossLimitBps,
    openedAt: policy.openedAt.toString(),
    expiresAt: policy.expiresAt.toString(),
    observedBlock: observedBlock.toString(),
    managerAddress: MAINNET_MANAGER_ADDRESS,
    network: "Arc",
  };
}

export async function readPolicyFromArc(
  policyId: bigint,
  rpcUrl = process.env.ARC_MAINNET_RPC_URL ?? "https://rpc.mainnet.arc.io",
): Promise<PolicyView> {
  const client = createPublicClient({ chain: arc, transport: http(rpcUrl) });
  const [policyResult, nextPolicyIdResult, observedBlockResult] = await Promise.allSettled([
    client.readContract({
      address: MAINNET_MANAGER_ADDRESS,
      abi: protectionManagerAbi,
      functionName: "getPolicy",
      args: [policyId],
    }),
    client.readContract({
      address: MAINNET_MANAGER_ADDRESS,
      abi: protectionManagerAbi,
      functionName: "nextPolicyId",
    }),
    client.getBlockNumber(),
  ]);

  if (nextPolicyIdResult.status === "fulfilled") {
    assertPolicyExists(policyId, nextPolicyIdResult.value);
  }
  if (policyResult.status === "rejected") throw policyResult.reason;
  if (nextPolicyIdResult.status === "rejected") throw nextPolicyIdResult.reason;
  if (observedBlockResult.status === "rejected") throw observedBlockResult.reason;

  const policy = policyResult.value;
  const observedBlock = observedBlockResult.value;
  const currentAssets =
    policy.status === 0
      ? await client.readContract({
          address: MAINNET_MANAGER_ADDRESS,
          abi: protectionManagerAbi,
          functionName: "getPolicyValue",
          args: [policyId],
        })
      : policy.assetsReturned;
  return toPolicyView(policyId, policy, currentAssets, observedBlock);
}
