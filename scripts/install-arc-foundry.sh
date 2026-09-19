#!/usr/bin/env bash

set -euo pipefail

agentsure_version="v0.8.0-1"
agentsure_os="$(uname -s)"
agentsure_arch="$(uname -m)"
agentsure_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agentsure_install_dir="${agentsure_root}/.tools/arc-foundry/${agentsure_version}"

case "${agentsure_os}/${agentsure_arch}" in
  Darwin/arm64)
    agentsure_target="aarch64-apple-darwin"
    agentsure_checksum_command=(shasum -a 256 -c)
    ;;
  Linux/x86_64)
    agentsure_target="x86_64-unknown-linux-gnu"
    agentsure_checksum_command=(sha256sum -c)
    ;;
  *)
    echo "Unsupported Arc Foundry platform: ${agentsure_os}/${agentsure_arch}" >&2
    echo "See https://github.com/circlefin/arc-foundry#building-from-source" >&2
    exit 1
    ;;
esac

agentsure_archive="arc-foundry-${agentsure_version}-${agentsure_target}.tar.gz"
agentsure_release_url="https://github.com/circlefin/arc-foundry/releases/download/${agentsure_version}"

if [[ -x "${agentsure_install_dir}/forge" && -x "${agentsure_install_dir}/cast" && -x "${agentsure_install_dir}/anvil" ]]; then
  echo "Arc Foundry ${agentsure_version} is already installed."
  exit 0
fi

agentsure_tmp_dir="$(mktemp -d)"
trap 'rm -rf "${agentsure_tmp_dir}"' EXIT

curl --proto '=https' --tlsv1.2 --fail --location --retry 3 \
  --output "${agentsure_tmp_dir}/${agentsure_archive}" \
  "${agentsure_release_url}/${agentsure_archive}"

curl --proto '=https' --tlsv1.2 --fail --location --retry 3 \
  --output "${agentsure_tmp_dir}/${agentsure_archive}.sha256" \
  "${agentsure_release_url}/${agentsure_archive}.sha256"

(
  cd "${agentsure_tmp_dir}"
  "${agentsure_checksum_command[@]}" "${agentsure_archive}.sha256"
)

mkdir -p "${agentsure_install_dir}"
tar -xzf "${agentsure_tmp_dir}/${agentsure_archive}" -C "${agentsure_install_dir}"

for agentsure_binary in forge cast anvil; do
  if [[ ! -x "${agentsure_install_dir}/${agentsure_binary}" ]]; then
    echo "Arc Foundry archive did not contain executable ${agentsure_binary}." >&2
    exit 1
  fi
done

echo "Installed Arc Foundry ${agentsure_version} in ${agentsure_install_dir}."
