#!/usr/bin/env bash
set -euo pipefail

readonly SLITHER_VERSION="0.11.6"
readonly SOLC_VERSION="0.8.30"
readonly ARC_FOUNDRY_VERSION="v0.8.0-1"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly SLITHER_BINARY="${REPOSITORY_ROOT}/.tools/slither-${SLITHER_VERSION}/bin/slither"
readonly SOLC_BINARY="${REPOSITORY_ROOT}/.tools/slither-${SLITHER_VERSION}/bin/solc"
readonly ARC_FOUNDRY_DIRECTORY="${REPOSITORY_ROOT}/.tools/arc-foundry/${ARC_FOUNDRY_VERSION}"

if [[ ! -x "${SLITHER_BINARY}" ]]; then
  echo "Slither is not installed. Run: npm run security:install" >&2
  exit 1
fi

if [[ ! -x "${ARC_FOUNDRY_DIRECTORY}/forge" ]]; then
  echo "Arc Foundry is not installed. Run: npm run arc:install" >&2
  exit 1
fi

export PATH="${ARC_FOUNDRY_DIRECTORY}:${PATH}"
cd "${REPOSITORY_ROOT}/packages/contracts"

for source_file in src/*.sol; do
  "${SLITHER_BINARY}" "${source_file}" \
    --compile-force-framework solc \
    --solc "${SOLC_BINARY}" \
    --solc-remaps "@openzeppelin/contracts/=../../node_modules/@openzeppelin/contracts/" \
    --solc-args "--allow-paths ../../node_modules" \
    --config-file slither.config.json
done

echo "Slither ${SLITHER_VERSION} completed with upstream solc ${SOLC_VERSION}."
