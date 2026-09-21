// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { DemoRiskVault } from "../src/DemoRiskVault.sol";
import { ProtectionManager } from "../src/ProtectionManager.sol";
import { DeployProtectionBase } from "./DeployProtectionBase.s.sol";

/// @notice Deploys the grant demonstration with an immutable one-USDC system-wide vault cap.
contract DeployProtectionMainnet is DeployProtectionBase {
    uint256 public constant USDC_UNIT = 1e6;
    uint256 public constant PROTECTION_FEE_ASSETS = 10_000; // 0.01 USDC
    uint256 public constant MAX_PRINCIPAL_ASSETS = USDC_UNIT;
    uint256 public constant VAULT_DEPOSIT_CAP = USDC_UNIT;
    uint64 public constant MIN_DURATION = 5 minutes;
    uint64 public constant MAX_DURATION = 7 days;
    uint16 public constant MIN_LOSS_LIMIT_BPS = 100; // 1%
    uint16 public constant MAX_LOSS_LIMIT_BPS = 5_000; // 50%

    function run() external returns (DemoRiskVault vault, ProtectionManager manager) {
        return _deploy(
            DeploymentBounds({
                protectionFeeAssets: PROTECTION_FEE_ASSETS,
                maxPrincipalAssets: MAX_PRINCIPAL_ASSETS,
                vaultDepositCap: VAULT_DEPOSIT_CAP,
                minDuration: MIN_DURATION,
                maxDuration: MAX_DURATION,
                minLossLimitBps: MIN_LOSS_LIMIT_BPS,
                maxLossLimitBps: MAX_LOSS_LIMIT_BPS
            })
        );
    }
}
