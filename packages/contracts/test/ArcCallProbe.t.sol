// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ArcCallProbe } from "../src/ArcCallProbe.sol";

contract ArcCallProbeTest {
    function test_RecordPersistsCallerAndCorrelationId() external {
        ArcCallProbe probe = new ArcCallProbe();
        bytes32 correlationId = keccak256("agentsure-milestone-1");

        probe.record(correlationId);

        require(probe.lastCaller() == address(this), "unexpected caller");
        require(probe.lastCorrelationId() == correlationId, "unexpected correlation id");
        require(probe.callCount() == 1, "unexpected call count");
    }

    function testFuzz_RecordCountsEveryCall(bytes32 correlationId) external {
        ArcCallProbe probe = new ArcCallProbe();

        probe.record(correlationId);
        probe.record(correlationId);

        require(probe.lastCorrelationId() == correlationId, "unexpected correlation id");
        require(probe.callCount() == 2, "unexpected call count");
    }

    function test_UsesOfficialArcUsdcInterface() external {
        ArcCallProbe probe = new ArcCallProbe();

        require(
            probe.ARC_USDC() == 0x3600000000000000000000000000000000000000,
            "unexpected Arc USDC address"
        );
    }
}
