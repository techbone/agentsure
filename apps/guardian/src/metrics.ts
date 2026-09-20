export class GuardianMetrics {
  activePolicyCount = 0;
  executionFailuresTotal = 0;
  executionsTotal = 0;
  lastFinalizedBlock = 0n;
  lastSuccessfulCycleTimestampSeconds = 0;
  rpcFailuresTotal = 0;
  simulationFailuresTotal = 0;

  toPrometheus(): string {
    return [
      "# HELP agentsure_guardian_last_finalized_block Latest finalized Arc block processed.",
      "# TYPE agentsure_guardian_last_finalized_block gauge",
      `agentsure_guardian_last_finalized_block ${this.lastFinalizedBlock}`,
      "# HELP agentsure_guardian_active_policies Active policies currently tracked.",
      "# TYPE agentsure_guardian_active_policies gauge",
      `agentsure_guardian_active_policies ${this.activePolicyCount}`,
      "# HELP agentsure_guardian_executions_total Confirmed protection executions.",
      "# TYPE agentsure_guardian_executions_total counter",
      `agentsure_guardian_executions_total ${this.executionsTotal}`,
      "# HELP agentsure_guardian_execution_failures_total Failed transaction submissions or receipts.",
      "# TYPE agentsure_guardian_execution_failures_total counter",
      `agentsure_guardian_execution_failures_total ${this.executionFailuresTotal}`,
      "# HELP agentsure_guardian_simulation_failures_total Failed pre-submission simulations.",
      "# TYPE agentsure_guardian_simulation_failures_total counter",
      `agentsure_guardian_simulation_failures_total ${this.simulationFailuresTotal}`,
      "# HELP agentsure_guardian_rpc_failures_total Failed Arc read or event requests.",
      "# TYPE agentsure_guardian_rpc_failures_total counter",
      `agentsure_guardian_rpc_failures_total ${this.rpcFailuresTotal}`,
      "# HELP agentsure_guardian_last_successful_cycle_timestamp_seconds Unix time of the last successful cycle.",
      "# TYPE agentsure_guardian_last_successful_cycle_timestamp_seconds gauge",
      `agentsure_guardian_last_successful_cycle_timestamp_seconds ${this.lastSuccessfulCycleTimestampSeconds}`,
      "",
    ].join("\n");
  }
}
