// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";

import { DemoRiskVault } from "../src/DemoRiskVault.sol";
import { ProtectionManager } from "../src/ProtectionManager.sol";

contract DeployProtection is Script {
    uint256 public constant USDC_UNIT = 1e6;
    uint256 public constant PROTECTION_FEE_ASSETS = 10_000; // 0.01 USDC
    uint256 public constant MAX_PRINCIPAL_ASSETS = 2 * USDC_UNIT;
    uint256 public constant VAULT_DEPOSIT_CAP = 10 * USDC_UNIT;
    uint64 public constant MIN_DURATION = 5 minutes;
    uint64 public constant MAX_DURATION = 7 days;
    uint16 public constant MIN_LOSS_LIMIT_BPS = 100; // 1%
    uint16 public constant MAX_LOSS_LIMIT_BPS = 5_000; // 50%

    function run() external returns (DemoRiskVault vault, ProtectionManager manager) {
        IERC20 assetToken = IERC20(vm.envAddress("AGENTSURE_ASSET_TOKEN"));
        address admin = vm.envAddress("AGENTSURE_ADMIN");
        address treasury = vm.envAddress("AGENTSURE_TREASURY");
        address lossSink = vm.envAddress("AGENTSURE_LOSS_SINK");

        vm.startBroadcast();

        vault = new DemoRiskVault(assetToken, admin, lossSink, VAULT_DEPOSIT_CAP);
        manager = new ProtectionManager(
            assetToken,
            treasury,
            admin,
            PROTECTION_FEE_ASSETS,
            MAX_PRINCIPAL_ASSETS,
            MIN_DURATION,
            MAX_DURATION,
            MIN_LOSS_LIMIT_BPS,
            MAX_LOSS_LIMIT_BPS
        );
        manager.setVaultAllowed(address(vault), true);

        vm.stopBroadcast();

        console2.log("DemoRiskVault:", address(vault));
        console2.log("ProtectionManager:", address(manager));
    }
}
