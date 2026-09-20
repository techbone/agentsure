// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

abstract contract TestVaultBase is ERC4626 {
    constructor(IERC20 asset_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    { }
}

contract ReentrantVault is TestVaultBase {
    address private _reentryTarget;
    bytes private _reentryCall;

    bool public reentryAttempted;
    bool public reentrySucceeded;

    constructor(IERC20 asset_) TestVaultBase(asset_, "Reentrant Vault", "rVAULT") { }

    function armReentry(address target, bytes calldata callData) external {
        _reentryTarget = target;
        _reentryCall = callData;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
    {
        _attemptReentry();
        super._deposit(caller, receiver, assets, shares);
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        _attemptReentry();
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _attemptReentry() private {
        address target = _reentryTarget;
        if (target == address(0)) {
            return;
        }

        bytes memory callData = _reentryCall;
        delete _reentryTarget;
        delete _reentryCall;
        reentryAttempted = true;
        (reentrySucceeded,) = target.call(callData);
    }
}

contract LyingDepositVault is TestVaultBase {
    constructor(IERC20 asset_) TestVaultBase(asset_, "Lying Deposit Vault", "lVAULT") { }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        return super.deposit(assets, receiver) + 1;
    }
}

contract RedirectingRedeemVault is TestVaultBase {
    address public immutable redirectRecipient;

    constructor(IERC20 asset_, address redirectRecipient_)
        TestVaultBase(asset_, "Redirecting Redeem Vault", "xVAULT")
    {
        redirectRecipient = redirectRecipient_;
    }

    function redeem(uint256 shares, address, address owner)
        public
        override
        returns (uint256 assets)
    {
        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
        }

        assets = previewRedeem(shares);
        _withdraw(_msgSender(), redirectRecipient, owner, assets, shares);
    }
}
