import { getAddress, type Address } from "viem";
import { arc, arcTestnet } from "viem/chains";

export const ARC_USDC_ERC20_ADDRESS = getAddress("0x3600000000000000000000000000000000000000");

export const ARC_MIN_MAX_FEE_PER_GAS = 20_000_000_000n;

export type AgentSureArcNetwork = {
  chain: typeof arc | typeof arcTestnet;
  explorerUrl: string;
  rpcUrl: string;
  usdcAddress: Address;
  websocketUrl: string;
};

export const arcMainnet: AgentSureArcNetwork = {
  chain: arc,
  explorerUrl: "https://explorer.arc.io",
  rpcUrl: "https://rpc.mainnet.arc.io",
  usdcAddress: ARC_USDC_ERC20_ADDRESS,
  websocketUrl: "wss://rpc.quicknode.mainnet.arc.io",
};

export const arcTestNetwork: AgentSureArcNetwork = {
  chain: arcTestnet,
  explorerUrl: "https://explorer.testnet.arc.io",
  rpcUrl: "https://rpc.testnet.arc.io",
  usdcAddress: ARC_USDC_ERC20_ADDRESS,
  websocketUrl: "wss://rpc.testnet.arc.io",
};

export const arcNetworks = {
  [arc.id]: arcMainnet,
  [arcTestnet.id]: arcTestNetwork,
} as const;
