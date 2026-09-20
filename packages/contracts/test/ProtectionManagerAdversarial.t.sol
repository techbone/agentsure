// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";

import { ProtectionManager } from "../src/ProtectionManager.sol";
import {
    LyingDepositVault,
    RedirectingRedeemVault,
    ReentrantVault,
    TestVaultBase
} from "./mocks/MaliciousVaults.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract ProtectionManagerAdversarialTest is Test {
    uint256 private constant USDC = 1e6;
    uint256 private constant FEE = 10_000;
    uint64 private constant DURATION = 1 days;
    uint16 private constant LOSS_LIMIT_BPS = 300;

    address private user = makeAddr("adversarial-user");
    address private beneficiary = makeAddr("adversarial-beneficiary");
    address private attacker = makeAddr("attacker");

    MockUSDC private usdc;
    ProtectionManager private manager;

    function setUp() public {
        usdc = new MockUSDC();
        manager = new ProtectionManager(
            usdc,
            makeAddr("adversarial-treasury"),
            address(this),
            FEE,
            10 * USDC,
            1 hours,
            7 days,
            100,
            5_000
        );

        usdc.mint(user, 100 * USDC);
        vm.prank(user);
        usdc.approve(address(manager), type(uint256).max);
    }

    function test_ReentrantVaultCannotReenterDuringDepositOrExit() public {
        ReentrantVault vault = new ReentrantVault(usdc);
        manager.setVaultAllowed(address(vault), true);

        bytes memory nestedOpenCall = abi.encodeCall(
            ProtectionManager.openPolicy,
            (address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC)
        );
        vault.armReentry(address(manager), nestedOpenCall);

        vm.prank(user);
        (uint256 policyId,) =
            manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC);

        assertTrue(vault.reentryAttempted());
        assertFalse(vault.reentrySucceeded());
        assertEq(manager.nextPolicyId(), 2);

        bytes memory nestedCancelCall =
            abi.encodeCall(ProtectionManager.cancelPolicy, (policyId, 0));
        vault.armReentry(address(manager), nestedCancelCall);

        vm.prank(user);
        manager.cancelPolicy(policyId, USDC);

        assertTrue(vault.reentryAttempted());
        assertFalse(vault.reentrySucceeded());
        assertEq(usdc.balanceOf(beneficiary), USDC);
    }

    function test_LyingDepositReturnValueRevertsAtomically() public {
        LyingDepositVault vault = new LyingDepositVault(usdc);
        manager.setVaultAllowed(address(vault), true);

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.UnexpectedShareAmount.selector, USDC + 1, USDC)
        );
        vm.prank(user);
        manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC);

        assertEq(usdc.balanceOf(user), 100 * USDC);
        assertEq(usdc.balanceOf(manager.treasury()), 0);
        assertEq(vault.balanceOf(address(manager)), 0);
        assertEq(manager.nextPolicyId(), 1);
    }

    function test_RedirectingVaultCannotDivertExitProceeds() public {
        RedirectingRedeemVault vault = new RedirectingRedeemVault(usdc, attacker);
        manager.setVaultAllowed(address(vault), true);

        vm.prank(user);
        (uint256 policyId, uint256 shares) =
            manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC);

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.UnexpectedAssetAmount.selector, USDC, 0)
        );
        vm.prank(user);
        manager.cancelPolicy(policyId, 0);

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        assertEq(usdc.balanceOf(attacker), 0);
        assertEq(usdc.balanceOf(beneficiary), 0);
        assertEq(vault.balanceOf(address(manager)), shares);
        assertEq(uint8(policy.status), uint8(ProtectionManager.PolicyStatus.Active));
    }

    function test_VaultWithWrongAssetCannotBeAllowed() public {
        MockUSDC wrongAsset = new MockUSDC();
        TestVaultBase wrongVault = new LyingDepositVault(wrongAsset);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtectionManager.VaultAssetMismatch.selector,
                address(wrongVault),
                address(usdc),
                address(wrongAsset)
            )
        );
        manager.setVaultAllowed(address(wrongVault), true);
    }
}
