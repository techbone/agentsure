#!/usr/bin/env bash
set -euo pipefail

readonly CIRCLE_CLI_VERSION="1.1.4"
readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly INSTALL_DIRECTORY="${REPOSITORY_ROOT}/.tools/circle-cli-${CIRCLE_CLI_VERSION}"
readonly CIRCLE_BINARY="${INSTALL_DIRECTORY}/node_modules/.bin/circle"

if [[ -x "${CIRCLE_BINARY}" ]]; then
  installed_version="$(${CIRCLE_BINARY} --version)"
  if [[ "${installed_version}" == *"${CIRCLE_CLI_VERSION}"* ]]; then
    echo "Circle CLI ${CIRCLE_CLI_VERSION} is already installed."
    exit 0
  fi
fi

mkdir -p "${INSTALL_DIRECTORY}"
npm install \
  --prefix "${INSTALL_DIRECTORY}" \
  --no-package-lock \
  --ignore-scripts \
  --save-exact \
  "@circle-fin/cli@${CIRCLE_CLI_VERSION}"

if [[ ! -x "${CIRCLE_BINARY}" ]]; then
  echo "Circle CLI installation did not produce an executable." >&2
  exit 1
fi

"${CIRCLE_BINARY}" --version
