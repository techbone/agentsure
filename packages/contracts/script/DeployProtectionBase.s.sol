// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";

import { DemoRiskVault } from "../src/DemoRiskVault.sol";
import { ProtectionManager } from "../src/ProtectionManager.sol";

abstract contract DeployProtectionBase is Script {
    struct DeploymentBounds {
        uint256 protectionFeeAssets;
        uint256 maxPrincipalAssets;
        uint256 vaultDepositCap;
        uint64 minDuration;
        uint64 maxDuration;
        uint16 minLossLimitBps;
        uint16 maxLossLimitBps;
    }

    function _deploy(DeploymentBounds memory bounds)
        internal
        returns (DemoRiskVault vault, ProtectionManager manager)
    {
        IERC20 assetToken = IERC20(vm.envAddress("AGENTSURE_ASSET_TOKEN"));
        address admin = vm.envAddress("AGENTSURE_ADMIN");
        address treasury = vm.envAddress("AGENTSURE_TREASURY");
        address lossSink = vm.envAddress("AGENTSURE_LOSS_SINK");

        vm.startBroadcast();

        vault = new DemoRiskVault(assetToken, admin, lossSink, bounds.vaultDepositCap);
        manager = new ProtectionManager(
            assetToken,
            treasury,
            admin,
            bounds.protectionFeeAssets,
            bounds.maxPrincipalAssets,
            bounds.minDuration,
            bounds.maxDuration,
            bounds.minLossLimitBps,
            bounds.maxLossLimitBps
        );
        manager.setVaultAllowed(address(vault), true);

        vm.stopBroadcast();

        console2.log("DemoRiskVault:", address(vault));
        console2.log("ProtectionManager:", address(manager));
    }
}
