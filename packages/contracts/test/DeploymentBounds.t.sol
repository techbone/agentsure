// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";

import { DeployProtection } from "../script/DeployProtection.s.sol";
import { DeployProtectionMainnet } from "../script/DeployProtectionMainnet.s.sol";

contract DeploymentBoundsTest is Test {
    function test_MainnetDeploymentIsStrictlyCapped() public {
        DeployProtectionMainnet deployment = new DeployProtectionMainnet();

        assertEq(deployment.MAX_PRINCIPAL_ASSETS(), 1e6);
        assertEq(deployment.VAULT_DEPOSIT_CAP(), 1e6);
        assertEq(deployment.PROTECTION_FEE_ASSETS(), 10_000);
        assertEq(deployment.MAX_DURATION(), 7 days);
        assertEq(deployment.MIN_LOSS_LIMIT_BPS(), 100);
        assertEq(deployment.MAX_LOSS_LIMIT_BPS(), 5_000);
    }

    function test_TestnetDeploymentRetainsExistingBounds() public {
        DeployProtection deployment = new DeployProtection();

        assertEq(deployment.MAX_PRINCIPAL_ASSETS(), 2e6);
        assertEq(deployment.VAULT_DEPOSIT_CAP(), 10e6);
        assertEq(deployment.PROTECTION_FEE_ASSETS(), 10_000);
    }
}
