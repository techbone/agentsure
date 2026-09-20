#!/usr/bin/env bash
set -euo pipefail

readonly MODE="${1:-simulate}"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly CONTRACTS_DIRECTORY="${REPOSITORY_ROOT}/packages/contracts"
readonly FORGE_BINARY="${REPOSITORY_ROOT}/.tools/arc-foundry/v0.8.0-1/forge"
readonly DEPLOYER="0x7602fB6EB360f28d9DE0e5adA6F8576A1f2CaEd5"

export AGENTSURE_ASSET_TOKEN="0x3600000000000000000000000000000000000000"
export AGENTSURE_ADMIN="${DEPLOYER}"
export AGENTSURE_TREASURY="${DEPLOYER}"
export AGENTSURE_LOSS_SINK="0x000000000000000000000000000000000000dEaD"
export FOUNDRY_PROFILE="arc"

cd "${CONTRACTS_DIRECTORY}"

case "${MODE}" in
  simulate)
    exec "${FORGE_BINARY}" script script/DeployProtection.s.sol:DeployProtection \
      --rpc-url https://rpc.testnet.arc.io \
      --sender "${DEPLOYER}"
    ;;
  broadcast)
    exec "${FORGE_BINARY}" script script/DeployProtection.s.sol:DeployProtection \
      --rpc-url https://rpc.testnet.arc.io \
      --keystore keystores/agentsure-testnet-deployer \
      --broadcast \
      --slow
    ;;
  *)
    echo "Usage: $0 [simulate|broadcast]" >&2
    exit 1
    ;;
esac
