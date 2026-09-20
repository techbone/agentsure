// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Test } from "forge-std/Test.sol";

import { DemoRiskVault } from "../src/DemoRiskVault.sol";
import { ProtectionManager } from "../src/ProtectionManager.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract ProtectionManagerFuzzTest is Test {
    uint256 private constant USDC = 1e6;
    uint256 private constant FEE = 10_000;
    uint256 private constant MAX_PRINCIPAL = 10 * USDC;
    uint64 private constant MIN_DURATION = 1 hours;
    uint64 private constant MAX_DURATION = 7 days;
    uint16 private constant MIN_LOSS_BPS = 100;
    uint16 private constant MAX_LOSS_BPS = 5_000;

    address private user = makeAddr("fuzz-user");
    address private beneficiary = makeAddr("fuzz-beneficiary");

    MockUSDC private usdc;
    DemoRiskVault private vault;
    ProtectionManager private manager;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new DemoRiskVault(usdc, address(this), makeAddr("loss-sink"), 100 * USDC);
        manager = new ProtectionManager(
            usdc,
            makeAddr("treasury"),
            address(this),
            FEE,
            MAX_PRINCIPAL,
            MIN_DURATION,
            MAX_DURATION,
            MIN_LOSS_BPS,
            MAX_LOSS_BPS
        );
        manager.setVaultAllowed(address(vault), true);
        usdc.mint(user, 1_000 * USDC);
        vm.prank(user);
        usdc.approve(address(manager), type(uint256).max);
    }

    function testFuzz_OpenPolicyRecordsExactBoundedTerms(
        uint96 principalSeed,
        uint16 lossSeed,
        uint32 durationSeed
    ) public {
        uint256 principal = bound(principalSeed, 100, MAX_PRINCIPAL);
        uint16 lossLimitBps = uint16(bound(lossSeed, MIN_LOSS_BPS, MAX_LOSS_BPS));
        uint64 duration = uint64(bound(durationSeed, MIN_DURATION, MAX_DURATION));
        uint256 expectedShares = vault.previewDeposit(principal);

        vm.prank(user);
        (uint256 policyId, uint256 shares) = manager.openPolicy(
            address(vault), beneficiary, principal, lossLimitBps, duration, expectedShares
        );

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        assertEq(shares, expectedShares);
        assertEq(policy.shares, expectedShares);
        assertEq(
            policy.triggerAssets,
            Math.mulDiv(
                principal, manager.BPS_DENOMINATOR() - lossLimitBps, manager.BPS_DENOMINATOR()
            )
        );
        assertEq(policy.expiresAt - policy.openedAt, duration);
        assertEq(manager.activeSharesByVault(address(vault)), shares);
        assertGe(vault.balanceOf(address(manager)), shares);
    }

    function testFuzz_LossAtOrBeyondLimitAllowsPermissionlessExit(
        uint96 principalSeed,
        uint16 lossSeed,
        uint16 extraLossSeed
    ) public {
        uint256 principal = bound(principalSeed, 10_000, MAX_PRINCIPAL);
        uint16 lossLimitBps = uint16(bound(lossSeed, MIN_LOSS_BPS, MAX_LOSS_BPS));
        uint256 minimumLoss = Math.ceilDiv(principal * lossLimitBps, 10_000);
        uint256 maximumExtraLoss = principal - minimumLoss - 1;
        uint256 extraLoss = bound(extraLossSeed, 0, maximumExtraLoss);
        uint256 minimumShares = vault.previewDeposit(principal);

        vm.prank(user);
        (uint256 policyId,) = manager.openPolicy(
            address(vault), beneficiary, principal, lossLimitBps, MIN_DURATION, minimumShares
        );
        vault.simulateLoss(minimumLoss + extraLoss);

        uint256 expectedAssets = manager.getPolicyValue(policyId);
        address arbitraryExecutor = makeAddr("arbitrary-executor");
        vm.prank(arbitraryExecutor);
        uint256 assetsReturned = manager.executeProtection(policyId, expectedAssets);

        assertEq(assetsReturned, expectedAssets);
        assertEq(usdc.balanceOf(beneficiary), expectedAssets);
        assertEq(usdc.balanceOf(arbitraryExecutor), 0);
        assertEq(manager.activeSharesByVault(address(vault)), 0);
    }

    function testFuzz_CancellationReturnsCurrentPreviewValue(uint96 principalSeed, uint16 lossSeed)
        public
    {
        uint256 principal = bound(principalSeed, 10_000, MAX_PRINCIPAL);
        uint256 loss = bound(lossSeed, 1, principal - 1);
        uint256 minimumShares = vault.previewDeposit(principal);

        vm.prank(user);
        (uint256 policyId,) = manager.openPolicy(
            address(vault), beneficiary, principal, MIN_LOSS_BPS, MIN_DURATION, minimumShares
        );
        vault.simulateLoss(loss);
        uint256 expectedAssets = manager.getPolicyValue(policyId);

        vm.prank(user);
        uint256 assetsReturned = manager.cancelPolicy(policyId, expectedAssets);

        assertEq(assetsReturned, expectedAssets);
        assertEq(usdc.balanceOf(beneficiary), expectedAssets);
        assertEq(vault.balanceOf(address(manager)), 0);
    }
}
