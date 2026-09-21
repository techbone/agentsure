export const demoRiskVaultAbi = [
  {
    type: "event",
    name: "DemoLossSimulated",
    inputs: [
      { indexed: true, name: "operator", type: "address" },
      { indexed: true, name: "lossSink", type: "address" },
      { indexed: false, name: "lossAssets", type: "uint256" },
      { indexed: false, name: "totalAssetsBefore", type: "uint256" },
      { indexed: false, name: "totalAssetsAfter", type: "uint256" },
      { indexed: false, name: "assetsPerShareBefore", type: "uint256" },
      { indexed: false, name: "assetsPerShareAfter", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "simulateLoss",
    stateMutability: "nonpayable",
    inputs: [{ name: "lossAssets", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "previewDeposit",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxDeposit",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "maxAssets", type: "uint256" }],
  },
] as const;
