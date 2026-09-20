// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title ProtectionManager
/// @notice Holds ERC-4626 shares and enforces deterministic downside exits for bounded USDC positions.
/// @dev V1 automates exits. It does not insure or reimburse losses.
contract ProtectionManager is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    enum PolicyStatus {
        Active,
        Executed,
        Cancelled,
        Expired
    }

    struct Policy {
        address owner;
        address beneficiary;
        address vault;
        uint256 principalAssets;
        uint256 shares;
        uint256 triggerAssets;
        uint256 assetsReturned;
        uint64 openedAt;
        uint64 expiresAt;
        uint16 lossLimitBps;
        PolicyStatus status;
    }

    error InvalidAddress();
    error InvalidConfiguration();
    error VaultNotAllowed(address vault);
    error VaultAssetMismatch(address vault, address expectedAsset, address actualAsset);
    error PrincipalOutOfBounds(uint256 principalAssets, uint256 maximum);
    error DurationOutOfBounds(uint256 duration, uint256 minimum, uint256 maximum);
    error LossLimitOutOfBounds(uint256 lossLimitBps, uint256 minimum, uint256 maximum);
    error InvalidBeneficiary(address beneficiary);
    error InvalidMinimumShares();
    error UnexpectedAssetAmount(uint256 expected, uint256 received);
    error UnexpectedShareAmount(uint256 reported, uint256 received);
    error InsufficientShares(uint256 received, uint256 minimum);
    error PolicyNotFound(uint256 policyId);
    error PolicyNotActive(uint256 policyId, PolicyStatus status);
    error NotPolicyOwner(address caller, address policyOwner);
    error ProtectionWindowEnded(uint256 policyId, uint256 expiresAt);
    error ProtectionWindowActive(uint256 policyId, uint256 expiresAt);
    error TriggerNotMet(uint256 currentAssets, uint256 triggerAssets);
    error ExitSlippage(uint256 assetsReturned, uint256 minimumAssets);
    error ShareAccountingMismatch(address vault, uint256 expectedBalance, uint256 actualBalance);

    event VaultPermissionUpdated(address indexed vault, bool allowed);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event PolicyOpened(
        uint256 indexed policyId,
        address indexed owner,
        address indexed beneficiary,
        address vault,
        uint256 principalAssets,
        uint256 shares,
        uint256 triggerAssets,
        uint16 lossLimitBps,
        uint64 expiresAt,
        uint256 protectionFeeAssets
    );
    event ProtectionExecuted(
        uint256 indexed policyId,
        address indexed executor,
        address indexed beneficiary,
        uint256 assetsReturned
    );
    event PolicyCancelled(
        uint256 indexed policyId,
        address indexed owner,
        address indexed beneficiary,
        uint256 assetsReturned
    );
    event ExpiredPolicyClosed(
        uint256 indexed policyId,
        address indexed executor,
        address indexed beneficiary,
        uint256 assetsReturned
    );

    IERC20 public immutable assetToken;
    uint256 public immutable protectionFeeAssets;
    uint256 public immutable maxPrincipalAssets;
    uint64 public immutable minDuration;
    uint64 public immutable maxDuration;
    uint16 public immutable minLossLimitBps;
    uint16 public immutable maxLossLimitBps;

    address public treasury;
    uint256 public nextPolicyId = 1;

    mapping(address vault => bool allowed) public isVaultAllowed;
    mapping(address vault => uint256 shares) public activeSharesByVault;
    mapping(uint256 policyId => Policy policy) private _policies;

    constructor(
        IERC20 assetToken_,
        address treasury_,
        address initialOwner_,
        uint256 protectionFeeAssets_,
        uint256 maxPrincipalAssets_,
        uint64 minDuration_,
        uint64 maxDuration_,
        uint16 minLossLimitBps_,
        uint16 maxLossLimitBps_
    ) Ownable(initialOwner_) {
        if (
            address(assetToken_) == address(0) || address(assetToken_).code.length == 0
                || treasury_ == address(0) || treasury_ == address(this)
        ) {
            revert InvalidAddress();
        }
        if (
            maxPrincipalAssets_ == 0 || minDuration_ == 0 || minDuration_ > maxDuration_
                || minLossLimitBps_ == 0 || minLossLimitBps_ > maxLossLimitBps_
                || maxLossLimitBps_ >= BPS_DENOMINATOR
        ) {
            revert InvalidConfiguration();
        }

        assetToken = assetToken_;
        treasury = treasury_;
        protectionFeeAssets = protectionFeeAssets_;
        maxPrincipalAssets = maxPrincipalAssets_;
        minDuration = minDuration_;
        maxDuration = maxDuration_;
        minLossLimitBps = minLossLimitBps_;
        maxLossLimitBps = maxLossLimitBps_;
    }

    /// @notice Opens a protected ERC-4626 position and records the exact shares received.
    function openPolicy(
        address vault,
        address beneficiary,
        uint256 principalAssets,
        uint16 lossLimitBps,
        uint64 duration,
        uint256 minimumShares
    ) external nonReentrant whenNotPaused returns (uint256 policyId, uint256 shares) {
        _validatePolicyRequest(
            vault, beneficiary, principalAssets, lossLimitBps, duration, minimumShares
        );

        shares = _collectFeeAndDeposit(vault, principalAssets, minimumShares);

        uint256 triggerAssets =
            Math.mulDiv(principalAssets, BPS_DENOMINATOR - lossLimitBps, BPS_DENOMINATOR);
        if (triggerAssets == 0) {
            revert InvalidConfiguration();
        }

        policyId = nextPolicyId++;
        uint64 openedAt = SafeCast.toUint64(block.timestamp);
        uint64 expiresAt = SafeCast.toUint64(block.timestamp + duration);

        Policy storage policy = _policies[policyId];
        policy.owner = msg.sender;
        policy.beneficiary = beneficiary;
        policy.vault = vault;
        policy.principalAssets = principalAssets;
        policy.shares = shares;
        policy.triggerAssets = triggerAssets;
        policy.openedAt = openedAt;
        policy.expiresAt = expiresAt;
        policy.lossLimitBps = lossLimitBps;
        policy.status = PolicyStatus.Active;
        activeSharesByVault[vault] += shares;
        _assertShareCoverage(vault);

        _emitPolicyOpened(policyId, policy);
    }

    /// @notice Executes a valid downside exit. Anyone may call; proceeds always go to the beneficiary.
    function executeProtection(uint256 policyId, uint256 minimumAssets)
        external
        nonReentrant
        returns (uint256 assetsReturned)
    {
        Policy storage policy = _getActivePolicy(policyId);
        if (block.timestamp >= policy.expiresAt) {
            revert ProtectionWindowEnded(policyId, policy.expiresAt);
        }

        uint256 currentAssets = IERC4626(policy.vault).previewRedeem(policy.shares);
        if (currentAssets > policy.triggerAssets) {
            revert TriggerNotMet(currentAssets, policy.triggerAssets);
        }

        assetsReturned = _exitPolicy(policy, PolicyStatus.Executed, minimumAssets);
        emit ProtectionExecuted(policyId, msg.sender, policy.beneficiary, assetsReturned);
    }

    /// @notice Lets the policy owner exit before the protection window ends.
    function cancelPolicy(uint256 policyId, uint256 minimumAssets)
        external
        nonReentrant
        returns (uint256 assetsReturned)
    {
        Policy storage policy = _getActivePolicy(policyId);
        if (msg.sender != policy.owner) {
            revert NotPolicyOwner(msg.sender, policy.owner);
        }
        if (block.timestamp >= policy.expiresAt) {
            revert ProtectionWindowEnded(policyId, policy.expiresAt);
        }

        assetsReturned = _exitPolicy(policy, PolicyStatus.Cancelled, minimumAssets);
        emit PolicyCancelled(policyId, msg.sender, policy.beneficiary, assetsReturned);
    }

    /// @notice Closes an expired policy so its funds cannot become stuck. Anyone may call.
    function closeExpiredPolicy(uint256 policyId, uint256 minimumAssets)
        external
        nonReentrant
        returns (uint256 assetsReturned)
    {
        Policy storage policy = _getActivePolicy(policyId);
        if (block.timestamp < policy.expiresAt) {
            revert ProtectionWindowActive(policyId, policy.expiresAt);
        }

        assetsReturned = _exitPolicy(policy, PolicyStatus.Expired, minimumAssets);
        emit ExpiredPolicyClosed(policyId, msg.sender, policy.beneficiary, assetsReturned);
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        Policy memory policy = _policies[policyId];
        if (policy.owner == address(0)) {
            revert PolicyNotFound(policyId);
        }
        return policy;
    }

    function getPolicyValue(uint256 policyId) external view returns (uint256) {
        Policy storage policy = _getPolicy(policyId);
        if (policy.status != PolicyStatus.Active) {
            return 0;
        }
        return IERC4626(policy.vault).previewRedeem(policy.shares);
    }

    /// @notice Allows or removes a vault for future policies. Existing policies remain executable.
    function setVaultAllowed(address vault, bool allowed) external onlyOwner {
        if (vault == address(0) || vault.code.length == 0) {
            revert InvalidAddress();
        }
        if (allowed) {
            address vaultAsset = IERC4626(vault).asset();
            if (vaultAsset != address(assetToken)) {
                revert VaultAssetMismatch(vault, address(assetToken), vaultAsset);
            }
        }

        isVaultAllowed[vault] = allowed;
        emit VaultPermissionUpdated(vault, allowed);
    }

    /// @notice Changes only the recipient of future protection fees.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0) || newTreasury == address(this)) {
            revert InvalidAddress();
        }

        address previousTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    /// @notice Stops new policy openings without blocking exits from active positions.
    function pauseOpenings() external onlyOwner {
        _pause();
    }

    function unpauseOpenings() external onlyOwner {
        _unpause();
    }

    function _validatePolicyRequest(
        address vault,
        address beneficiary,
        uint256 principalAssets,
        uint16 lossLimitBps,
        uint64 duration,
        uint256 minimumShares
    ) private view {
        if (!isVaultAllowed[vault]) {
            revert VaultNotAllowed(vault);
        }
        if (beneficiary == address(0) || beneficiary == address(this) || beneficiary == vault) {
            revert InvalidBeneficiary(beneficiary);
        }
        if (principalAssets == 0 || principalAssets > maxPrincipalAssets) {
            revert PrincipalOutOfBounds(principalAssets, maxPrincipalAssets);
        }
        if (duration < minDuration || duration > maxDuration) {
            revert DurationOutOfBounds(duration, minDuration, maxDuration);
        }
        if (lossLimitBps < minLossLimitBps || lossLimitBps > maxLossLimitBps) {
            revert LossLimitOutOfBounds(lossLimitBps, minLossLimitBps, maxLossLimitBps);
        }
        if (minimumShares == 0) {
            revert InvalidMinimumShares();
        }
    }

    function _collectFeeAndDeposit(address vault, uint256 principalAssets, uint256 minimumShares)
        private
        returns (uint256 shares)
    {
        uint256 totalAssetsRequired = principalAssets + protectionFeeAssets;
        uint256 assetBalanceBefore = assetToken.balanceOf(address(this));
        assetToken.safeTransferFrom(msg.sender, address(this), totalAssetsRequired);
        uint256 receivedAssets = assetToken.balanceOf(address(this)) - assetBalanceBefore;
        if (receivedAssets != totalAssetsRequired) {
            revert UnexpectedAssetAmount(totalAssetsRequired, receivedAssets);
        }

        if (protectionFeeAssets != 0) {
            assetToken.safeTransfer(treasury, protectionFeeAssets);
        }

        IERC4626 strategyVault = IERC4626(vault);
        uint256 shareBalanceBefore = strategyVault.balanceOf(address(this));
        assetToken.forceApprove(vault, principalAssets);
        uint256 reportedShares = strategyVault.deposit(principalAssets, address(this));
        assetToken.forceApprove(vault, 0);
        shares = strategyVault.balanceOf(address(this)) - shareBalanceBefore;

        if (reportedShares != shares) {
            revert UnexpectedShareAmount(reportedShares, shares);
        }
        if (shares < minimumShares) {
            revert InsufficientShares(shares, minimumShares);
        }
    }

    function _emitPolicyOpened(uint256 policyId, Policy storage policy) private {
        emit PolicyOpened(
            policyId,
            policy.owner,
            policy.beneficiary,
            policy.vault,
            policy.principalAssets,
            policy.shares,
            policy.triggerAssets,
            policy.lossLimitBps,
            policy.expiresAt,
            protectionFeeAssets
        );
    }

    function _exitPolicy(Policy storage policy, PolicyStatus finalStatus, uint256 minimumAssets)
        private
        returns (uint256 assetsReturned)
    {
        IERC4626 strategyVault = IERC4626(policy.vault);
        uint256 shares = policy.shares;
        uint256 beneficiaryBalanceBefore = assetToken.balanceOf(policy.beneficiary);
        uint256 vaultShareBalanceBefore = strategyVault.balanceOf(address(this));

        policy.status = finalStatus;
        activeSharesByVault[policy.vault] -= shares;

        uint256 reportedAssets = strategyVault.redeem(shares, policy.beneficiary, address(this));
        uint256 beneficiaryBalanceAfter = assetToken.balanceOf(policy.beneficiary);
        assetsReturned = beneficiaryBalanceAfter - beneficiaryBalanceBefore;

        if (reportedAssets != assetsReturned) {
            revert UnexpectedAssetAmount(reportedAssets, assetsReturned);
        }
        if (assetsReturned < minimumAssets) {
            revert ExitSlippage(assetsReturned, minimumAssets);
        }

        uint256 vaultShareBalanceAfter = strategyVault.balanceOf(address(this));
        if (vaultShareBalanceBefore - vaultShareBalanceAfter != shares) {
            revert UnexpectedShareAmount(shares, vaultShareBalanceBefore - vaultShareBalanceAfter);
        }

        policy.assetsReturned = assetsReturned;
        _assertShareCoverage(policy.vault);
    }

    function _getPolicy(uint256 policyId) private view returns (Policy storage policy) {
        policy = _policies[policyId];
        if (policy.owner == address(0)) {
            revert PolicyNotFound(policyId);
        }
    }

    function _getActivePolicy(uint256 policyId) private view returns (Policy storage policy) {
        policy = _getPolicy(policyId);
        if (policy.status != PolicyStatus.Active) {
            revert PolicyNotActive(policyId, policy.status);
        }
    }

    function _assertShareCoverage(address vault) private view {
        uint256 expectedBalance = activeSharesByVault[vault];
        uint256 actualBalance = IERC4626(vault).balanceOf(address(this));
        if (actualBalance < expectedBalance) {
            revert ShareAccountingMismatch(vault, expectedBalance, actualBalance);
        }
    }
}
