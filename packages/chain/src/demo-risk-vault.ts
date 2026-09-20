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
] as const;
