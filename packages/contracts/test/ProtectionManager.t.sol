// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Test } from "forge-std/Test.sol";

import { DemoRiskVault } from "../src/DemoRiskVault.sol";
import { ProtectionManager } from "../src/ProtectionManager.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";

contract ProtectionManagerTest is Test {
    uint256 private constant USDC = 1e6;
    uint256 private constant FEE = 10_000;
    uint256 private constant MAX_PRINCIPAL = 10 * USDC;
    uint64 private constant MIN_DURATION = 1 hours;
    uint64 private constant MAX_DURATION = 7 days;
    uint16 private constant MIN_LOSS_BPS = 100;
    uint16 private constant MAX_LOSS_BPS = 5_000;
    uint16 private constant LOSS_LIMIT_BPS = 300;
    uint64 private constant DURATION = 1 days;

    address private user = makeAddr("user");
    address private beneficiary = makeAddr("beneficiary");
    address private keeper = makeAddr("keeper");
    address private treasury = makeAddr("treasury");
    address private lossSink = makeAddr("loss-sink");

    MockUSDC private usdc;
    DemoRiskVault private vault;
    ProtectionManager private manager;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new DemoRiskVault(usdc, address(this), lossSink, 100 * USDC);
        manager = new ProtectionManager(
            usdc,
            treasury,
            address(this),
            FEE,
            MAX_PRINCIPAL,
            MIN_DURATION,
            MAX_DURATION,
            MIN_LOSS_BPS,
            MAX_LOSS_BPS
        );
        manager.setVaultAllowed(address(vault), true);

        usdc.mint(user, 100 * USDC);
        vm.prank(user);
        usdc.approve(address(manager), type(uint256).max);
    }

    function test_OpenPolicyCollectsFeeAndRecordsExactShares() public {
        (uint256 policyId, uint256 shares) = _openDefaultPolicy();
        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);

        assertEq(policyId, 1);
        assertEq(manager.nextPolicyId(), 2);
        assertEq(shares, USDC);
        assertEq(policy.owner, user);
        assertEq(policy.beneficiary, beneficiary);
        assertEq(policy.vault, address(vault));
        assertEq(policy.principalAssets, USDC);
        assertEq(policy.shares, shares);
        assertEq(policy.triggerAssets, 970_000);
        assertEq(policy.assetsReturned, 0);
        assertEq(policy.lossLimitBps, LOSS_LIMIT_BPS);
        assertEq(uint8(policy.status), uint8(ProtectionManager.PolicyStatus.Active));
        assertEq(policy.expiresAt - policy.openedAt, DURATION);
        assertEq(manager.activeSharesByVault(address(vault)), shares);
        assertEq(vault.balanceOf(address(manager)), shares);
        assertEq(usdc.balanceOf(treasury), FEE);
        assertEq(usdc.balanceOf(address(manager)), 0);
        assertEq(usdc.allowance(address(manager), address(vault)), 0);
        assertEq(manager.getPolicyValue(policyId), USDC);
    }

    function test_ExecuteProtectionAfterLossReturnsAssetsOnlyToBeneficiary() public {
        (uint256 policyId,) = _openDefaultPolicy();
        vault.simulateLoss(32_500);

        uint256 beneficiaryBefore = usdc.balanceOf(beneficiary);
        uint256 keeperBefore = usdc.balanceOf(keeper);
        vm.prank(keeper);
        uint256 assetsReturned = manager.executeProtection(policyId, 967_500);

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        assertEq(assetsReturned, 967_500);
        assertEq(usdc.balanceOf(beneficiary) - beneficiaryBefore, assetsReturned);
        assertEq(usdc.balanceOf(keeper), keeperBefore);
        assertEq(policy.assetsReturned, assetsReturned);
        assertEq(uint8(policy.status), uint8(ProtectionManager.PolicyStatus.Executed));
        assertEq(manager.getPolicyValue(policyId), 0);
        assertEq(manager.activeSharesByVault(address(vault)), 0);
        assertEq(vault.balanceOf(address(manager)), 0);
    }

    function test_ExecuteProtectionRevertsBeforeTrigger() public {
        (uint256 policyId,) = _openDefaultPolicy();

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.TriggerNotMet.selector, USDC, 970_000)
        );
        vm.prank(keeper);
        manager.executeProtection(policyId, 0);
    }

    function test_ExecuteProtectionRevertsAfterExpiry() public {
        (uint256 policyId,) = _openDefaultPolicy();
        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        vault.simulateLoss(32_500);
        vm.warp(policy.expiresAt);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtectionManager.ProtectionWindowEnded.selector, policyId, policy.expiresAt
            )
        );
        manager.executeProtection(policyId, 0);
    }

    function test_ExitSlippageRevertsWithoutChangingPolicy() public {
        (uint256 policyId, uint256 shares) = _openDefaultPolicy();
        vault.simulateLoss(32_500);

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.ExitSlippage.selector, 967_500, 967_501)
        );
        manager.executeProtection(policyId, 967_501);

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        assertEq(uint8(policy.status), uint8(ProtectionManager.PolicyStatus.Active));
        assertEq(manager.activeSharesByVault(address(vault)), shares);
        assertEq(vault.balanceOf(address(manager)), shares);
    }

    function test_OwnerCanCancelBeforeExpiry() public {
        (uint256 policyId,) = _openDefaultPolicy();

        vm.prank(user);
        uint256 assetsReturned = manager.cancelPolicy(policyId, USDC);

        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        assertEq(assetsReturned, USDC);
        assertEq(usdc.balanceOf(beneficiary), USDC);
        assertEq(uint8(policy.status), uint8(ProtectionManager.PolicyStatus.Cancelled));
    }

    function test_NonOwnerCannotCancel() public {
        (uint256 policyId,) = _openDefaultPolicy();

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.NotPolicyOwner.selector, keeper, user)
        );
        vm.prank(keeper);
        manager.cancelPolicy(policyId, 0);
    }

    function test_AnyoneCanCloseExpiredPolicy() public {
        (uint256 policyId,) = _openDefaultPolicy();
        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);
        vm.warp(policy.expiresAt);

        vm.prank(keeper);
        uint256 assetsReturned = manager.closeExpiredPolicy(policyId, USDC);

        policy = manager.getPolicy(policyId);
        assertEq(assetsReturned, USDC);
        assertEq(usdc.balanceOf(beneficiary), USDC);
        assertEq(uint8(policy.status), uint8(ProtectionManager.PolicyStatus.Expired));
    }

    function test_CloseExpiredPolicyRevertsDuringActiveWindow() public {
        (uint256 policyId,) = _openDefaultPolicy();
        ProtectionManager.Policy memory policy = manager.getPolicy(policyId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtectionManager.ProtectionWindowActive.selector, policyId, policy.expiresAt
            )
        );
        manager.closeExpiredPolicy(policyId, 0);
    }

    function test_CompletedPolicyCannotExecuteTwice() public {
        (uint256 policyId,) = _openDefaultPolicy();
        vault.simulateLoss(32_500);
        manager.executeProtection(policyId, 0);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtectionManager.PolicyNotActive.selector,
                policyId,
                ProtectionManager.PolicyStatus.Executed
            )
        );
        manager.executeProtection(policyId, 0);
    }

    function test_PauseBlocksOpeningsButNotActivePolicyExit() public {
        (uint256 policyId,) = _openDefaultPolicy();
        manager.pauseOpenings();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(user);
        manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC);

        vault.simulateLoss(32_500);
        manager.executeProtection(policyId, 0);
        assertEq(usdc.balanceOf(beneficiary), 967_500);
    }

    function test_RemovingVaultBlocksNewPoliciesButNotExistingExit() public {
        (uint256 policyId,) = _openDefaultPolicy();
        manager.setVaultAllowed(address(vault), false);

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.VaultNotAllowed.selector, address(vault))
        );
        vm.prank(user);
        manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC);

        vault.simulateLoss(32_500);
        manager.executeProtection(policyId, 0);
        assertEq(usdc.balanceOf(beneficiary), 967_500);
    }

    function test_OpenPolicyRejectsInvalidBounds() public {
        vm.startPrank(user);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtectionManager.PrincipalOutOfBounds.selector, 0, MAX_PRINCIPAL
            )
        );
        manager.openPolicy(address(vault), beneficiary, 0, LOSS_LIMIT_BPS, DURATION, 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtectionManager.DurationOutOfBounds.selector,
                MIN_DURATION - 1,
                MIN_DURATION,
                MAX_DURATION
            )
        );
        manager.openPolicy(
            address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, MIN_DURATION - 1, USDC
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ProtectionManager.LossLimitOutOfBounds.selector,
                MIN_LOSS_BPS - 1,
                MIN_LOSS_BPS,
                MAX_LOSS_BPS
            )
        );
        manager.openPolicy(address(vault), beneficiary, USDC, MIN_LOSS_BPS - 1, DURATION, USDC);

        vm.expectRevert(ProtectionManager.InvalidMinimumShares.selector);
        manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, 0);
        vm.stopPrank();
    }

    function test_OpenPolicyRejectsUnsafeBeneficiaries() public {
        vm.startPrank(user);
        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.InvalidBeneficiary.selector, address(0))
        );
        manager.openPolicy(address(vault), address(0), USDC, LOSS_LIMIT_BPS, DURATION, USDC);

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.InvalidBeneficiary.selector, address(manager))
        );
        manager.openPolicy(address(vault), address(manager), USDC, LOSS_LIMIT_BPS, DURATION, USDC);

        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.InvalidBeneficiary.selector, address(vault))
        );
        manager.openPolicy(address(vault), address(vault), USDC, LOSS_LIMIT_BPS, DURATION, USDC);
        vm.stopPrank();
    }

    function test_OpenPolicyEnforcesEntrySlippage() public {
        vm.expectRevert(
            abi.encodeWithSelector(ProtectionManager.InsufficientShares.selector, USDC, USDC + 1)
        );
        vm.prank(user);
        manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC + 1);

        assertEq(usdc.balanceOf(user), 100 * USDC);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(vault.balanceOf(address(manager)), 0);
    }

    function test_GetPolicyRejectsUnknownId() public {
        vm.expectRevert(abi.encodeWithSelector(ProtectionManager.PolicyNotFound.selector, 999));
        manager.getPolicy(999);
    }

    function test_DemoVaultEnforcesCapAndDisclosesLossSink() public {
        assertEq(vault.lossSink(), lossSink);
        assertEq(vault.depositCap(), 100 * USDC);

        usdc.mint(address(this), 101 * USDC);
        usdc.approve(address(vault), type(uint256).max);
        vm.expectRevert();
        vault.deposit(101 * USDC, address(this));
    }

    function test_DemoVaultOnlyOwnerCanSimulateBoundedLoss() public {
        _openDefaultPolicy();

        vm.expectRevert();
        vm.prank(keeper);
        vault.simulateLoss(1);

        vm.expectRevert(abi.encodeWithSelector(DemoRiskVault.InvalidLossAmount.selector, 0, USDC));
        vault.simulateLoss(0);

        vm.expectRevert(
            abi.encodeWithSelector(DemoRiskVault.InvalidLossAmount.selector, USDC, USDC)
        );
        vault.simulateLoss(USDC);
    }

    function _openDefaultPolicy() private returns (uint256 policyId, uint256 shares) {
        vm.prank(user);
        return manager.openPolicy(address(vault), beneficiary, USDC, LOSS_LIMIT_BPS, DURATION, USDC);
    }
}
