// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";

import { DemoRiskVault } from "../src/DemoRiskVault.sol";
import { ProtectionManager } from "../src/ProtectionManager.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract ProtectionManagerHandler is Test {
    uint256 private constant MIN_PRINCIPAL = 10_000;

    ProtectionManager public immutable manager;
    DemoRiskVault public immutable vault;
    MockUSDC public immutable usdc;
    address public immutable beneficiary;

    constructor(
        ProtectionManager manager_,
        DemoRiskVault vault_,
        MockUSDC usdc_,
        address beneficiary_
    ) {
        manager = manager_;
        vault = vault_;
        usdc = usdc_;
        beneficiary = beneficiary_;
        usdc.approve(address(manager), type(uint256).max);
    }

    function open(uint96 principalSeed, uint16 lossSeed, uint32 durationSeed) external {
        uint256 availableCapacity = vault.maxDeposit(address(manager));
        uint256 maximumPrincipal = _min(availableCapacity, manager.maxPrincipalAssets());
        if (maximumPrincipal < MIN_PRINCIPAL) {
            return;
        }

        uint256 principal = bound(principalSeed, MIN_PRINCIPAL, maximumPrincipal);
        uint16 lossLimitBps =
            uint16(bound(lossSeed, manager.minLossLimitBps(), manager.maxLossLimitBps()));
        uint64 duration = uint64(bound(durationSeed, manager.minDuration(), manager.maxDuration()));
        uint256 minimumShares = vault.previewDeposit(principal);
        if (minimumShares == 0) {
            return;
        }

        usdc.mint(address(this), principal + manager.protectionFeeAssets());
        manager.openPolicy(
            address(vault), beneficiary, principal, lossLimitBps, duration, minimumShares
        );
    }

    function cancel(uint256 policySeed) external {
        uint256 policyId = _existingPolicyId(policySeed);
        if (policyId == 0) {
            return;
        }

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        if (
            policy.status != ProtectionManager.PolicyStatus.Active
                || block.timestamp >= policy.expiresAt
        ) {
            return;
        }
        manager.cancelPolicy(policyId, 0);
    }

    function execute(uint256 policySeed) external {
        uint256 policyId = _existingPolicyId(policySeed);
        if (policyId == 0) {
            return;
        }

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        if (
            policy.status != ProtectionManager.PolicyStatus.Active
                || block.timestamp >= policy.expiresAt
                || manager.getPolicyValue(policyId) > policy.triggerAssets
        ) {
            return;
        }
        manager.executeProtection(policyId, 0);
    }

    function closeExpired(uint256 policySeed) external {
        uint256 policyId = _existingPolicyId(policySeed);
        if (policyId == 0) {
            return;
        }

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        if (
            policy.status != ProtectionManager.PolicyStatus.Active
                || block.timestamp < policy.expiresAt
        ) {
            return;
        }
        manager.closeExpiredPolicy(policyId, 0);
    }

    function simulateLoss(uint96 lossSeed) external {
        uint256 managedAssets = vault.totalAssets();
        if (managedAssets <= 1) {
            return;
        }
        vault.simulateLoss(bound(lossSeed, 1, managedAssets - 1));
    }

    function advanceTime(uint32 timeSeed) external {
        vm.warp(block.timestamp + bound(timeSeed, 1, 8 days));
    }

    function _existingPolicyId(uint256 seed) private view returns (uint256) {
        uint256 nextPolicyId = manager.nextPolicyId();
        return nextPolicyId == 1 ? 0 : bound(seed, 1, nextPolicyId - 1);
    }

    function _min(uint256 left, uint256 right) private pure returns (uint256) {
        return left < right ? left : right;
    }
}

contract ProtectionManagerInvariantTest is Test {
    uint256 private constant USDC = 1e6;

    address private beneficiary = makeAddr("invariant-beneficiary");
    address private treasury = makeAddr("invariant-treasury");
    address private lossSink = makeAddr("invariant-loss-sink");

    MockUSDC private usdc;
    DemoRiskVault private vault;
    ProtectionManager private manager;
    ProtectionManagerHandler private handler;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new DemoRiskVault(usdc, address(this), lossSink, 100 * USDC);
        manager = new ProtectionManager(
            usdc, treasury, address(this), 10_000, 10 * USDC, 1 hours, 7 days, 100, 5_000
        );
        manager.setVaultAllowed(address(vault), true);

        handler = new ProtectionManagerHandler(manager, vault, usdc, beneficiary);
        vault.transferOwnership(address(handler));
        vm.prank(address(handler));
        vault.acceptOwnership();

        targetContract(address(handler));
    }

    function invariant_ActivePolicySharesRemainFullyCovered() public view {
        uint256 activePolicyShares;
        uint256 nextPolicyId = manager.nextPolicyId();

        for (uint256 policyId = 1; policyId < nextPolicyId; ++policyId) {
            ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
            if (policy.status == ProtectionManager.PolicyStatus.Active) {
                activePolicyShares += policy.shares;
            }
        }

        assertEq(activePolicyShares, manager.activeSharesByVault(address(vault)));
        assertEq(vault.balanceOf(address(manager)), activePolicyShares);
    }

    function invariant_ManagerNeverRetainsUnderlyingAssets() public view {
        assertEq(usdc.balanceOf(address(manager)), 0);
    }

    function invariant_ExecutorCannotReceiveExitProceeds() public view {
        assertEq(usdc.balanceOf(address(handler)), 0);
    }

    function invariant_VaultNeverExceedsDepositCap() public view {
        assertLe(vault.totalAssets(), vault.depositCap());
    }
}
