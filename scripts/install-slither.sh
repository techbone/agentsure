#!/usr/bin/env bash
set -euo pipefail

readonly SLITHER_VERSION="0.11.6"
readonly SOLC_VERSION="0.8.30"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly INSTALL_DIRECTORY="${REPOSITORY_ROOT}/.tools/slither-${SLITHER_VERSION}"

if [[ ! -x "${INSTALL_DIRECTORY}/bin/slither" ]]; then
  python3 -m venv "${INSTALL_DIRECTORY}"
  "${INSTALL_DIRECTORY}/bin/python" -m pip install \
    --disable-pip-version-check \
    "slither-analyzer==${SLITHER_VERSION}"
fi

"${INSTALL_DIRECTORY}/bin/solc-select" install "${SOLC_VERSION}"
"${INSTALL_DIRECTORY}/bin/solc-select" use "${SOLC_VERSION}"

echo "Installed Slither ${SLITHER_VERSION} with upstream solc ${SOLC_VERSION}."
