// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title DemoRiskVault
/// @notice A capped ERC-4626 fixture for demonstrating a controlled loss on Arc.
/// @dev DEMO ONLY. This contract is not a yield product and must not hold meaningful value.
contract DemoRiskVault is ERC4626, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidAddress();
    error InvalidDepositCap();
    error InvalidLossAmount(uint256 requested, uint256 available);
    error UnexpectedLossTransfer(uint256 expected, uint256 actual);

    event DemoLossSimulated(
        address indexed operator,
        address indexed lossSink,
        uint256 lossAssets,
        uint256 totalAssetsBefore,
        uint256 totalAssetsAfter,
        uint256 assetsPerShareBefore,
        uint256 assetsPerShareAfter
    );

    address public immutable lossSink;
    uint256 public immutable depositCap;
    uint256 public immutable shareUnit;

    constructor(IERC20 asset_, address initialOwner_, address lossSink_, uint256 depositCap_)
        ERC20("AgentSure Demo Risk Vault", "asDRV")
        ERC4626(asset_)
        Ownable(initialOwner_)
    {
        if (
            address(asset_) == address(0) || address(asset_).code.length == 0
                || lossSink_ == address(0) || lossSink_ == address(this)
        ) {
            revert InvalidAddress();
        }
        if (depositCap_ == 0) {
            revert InvalidDepositCap();
        }

        lossSink = lossSink_;
        depositCap = depositCap_;
        shareUnit = 10 ** decimals();
    }

    function maxDeposit(address) public view override returns (uint256) {
        uint256 managedAssets = totalAssets();
        return managedAssets >= depositCap ? 0 : depositCap - managedAssets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return previewDeposit(maxDeposit(receiver));
    }

    /// @notice Transfers a disclosed amount to the immutable sink to create a deterministic demo loss.
    function simulateLoss(uint256 lossAssets) external onlyOwner nonReentrant {
        uint256 totalAssetsBefore = totalAssets();
        if (lossAssets == 0 || lossAssets >= totalAssetsBefore) {
            revert InvalidLossAmount(lossAssets, totalAssetsBefore);
        }

        uint256 assetsPerShareBefore = convertToAssets(shareUnit);
        uint256 sinkBalanceBefore = IERC20(asset()).balanceOf(lossSink);
        IERC20(asset()).safeTransfer(lossSink, lossAssets);
        uint256 sinkBalanceAfter = IERC20(asset()).balanceOf(lossSink);
        uint256 receivedBySink = sinkBalanceAfter - sinkBalanceBefore;
        if (receivedBySink != lossAssets) {
            revert UnexpectedLossTransfer(lossAssets, receivedBySink);
        }

        uint256 totalAssetsAfter = totalAssets();
        emit DemoLossSimulated(
            msg.sender,
            lossSink,
            lossAssets,
            totalAssetsBefore,
            totalAssetsAfter,
            assetsPerShareBefore,
            convertToAssets(shareUnit)
        );
    }
}
