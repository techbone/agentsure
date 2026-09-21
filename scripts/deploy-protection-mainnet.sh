#!/usr/bin/env bash
set -euo pipefail

readonly MODE="${1:-simulate}"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CONTRACTS_DIRECTORY="${REPOSITORY_ROOT}/packages/contracts"
readonly FORGE_BINARY="${REPOSITORY_ROOT}/.tools/arc-foundry/v0.8.0-1/forge"
readonly DEPLOYER="${AGENTSURE_MAINNET_DEPLOYER:-0x7602fB6EB360f28d9DE0e5adA6F8576A1f2CaEd5}"
readonly KEYSTORE="${AGENTSURE_MAINNET_DEPLOYER_KEYSTORE:-keystores/agentsure-testnet-deployer}"
readonly RPC_URL="${ARC_MAINNET_RPC_URL:-https://rpc.mainnet.arc.io}"

export AGENTSURE_ASSET_TOKEN="0x3600000000000000000000000000000000000000"
export AGENTSURE_ADMIN="${DEPLOYER}"
export AGENTSURE_TREASURY="${AGENTSURE_MAINNET_TREASURY:-${DEPLOYER}}"
export AGENTSURE_LOSS_SINK="${AGENTSURE_MAINNET_LOSS_SINK:-0x000000000000000000000000000000000000dEaD}"
export FOUNDRY_PROFILE="arc"

cd "${CONTRACTS_DIRECTORY}"

case "${MODE}" in
  simulate)
    exec "${FORGE_BINARY}" script \
      script/DeployProtectionMainnet.s.sol:DeployProtectionMainnet \
      --rpc-url "${RPC_URL}" \
      --sender "${DEPLOYER}"
    ;;
  broadcast)
    exec "${FORGE_BINARY}" script \
      script/DeployProtectionMainnet.s.sol:DeployProtectionMainnet \
      --rpc-url "${RPC_URL}" \
      --keystore "${KEYSTORE}" \
      --broadcast \
      --verify \
      --verifier blockscout \
      --verifier-url https://explorer.arc.io/api/ \
      --slow
    ;;
  *)
    echo "Usage: $0 [simulate|broadcast]" >&2
    exit 1
    ;;
esac
