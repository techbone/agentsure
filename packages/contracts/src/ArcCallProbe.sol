// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title ArcCallProbe
/// @notice A value-free test contract used to prove Circle Agent Wallet contract execution on Arc.
/// @dev This contract is not part of the AgentSure production protocol.
contract ArcCallProbe {
    address public constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    address public lastCaller;
    bytes32 public lastCorrelationId;
    uint256 public callCount;

    event ProbeCalled(address indexed caller, bytes32 indexed correlationId, uint256 callCount);

    function record(bytes32 correlationId) external {
        lastCaller = msg.sender;
        lastCorrelationId = correlationId;
        callCount += 1;

        emit ProbeCalled(msg.sender, correlationId, callCount);
    }
}
