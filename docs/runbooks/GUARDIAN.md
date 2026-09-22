# Guardian Operations Runbook

The AgentSure guardian is an independent Arc keeper. It observes finalized policy events, evaluates
objective onchain values, simulates valid exits, and submits `executeProtection` from a dedicated
low-value wallet.

The guardian never receives a Circle Agent Wallet credential. The user's wallet remains the policy
beneficiary, and the `ProtectionManager` sends redeemed USDC directly to that immutable address.

## Configuration

Copy `.env.example` to an ignored `.env` file and set only the dedicated keeper key in
`GUARDIAN_PRIVATE_KEY`. Do not reuse the deployer, treasury, or user wallet key.

The testnet defaults point to:

- Arc Testnet chain ID `5042002`;
- `ProtectionManager` at `0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5`;
- deployment block `63052386`;
- local state at `.data/guardian-state.json`;
- health and metrics on `127.0.0.1:9464`.

Hosted deployments must inject `GUARDIAN_PRIVATE_KEY` through their secrets manager. Environment
contents and the state directory must not be committed.

On Railway, the guardian automatically uses the platform-provided `PORT`. When a volume is attached,
it also derives its durable state path from `RAILWAY_VOLUME_MOUNT_PATH`. See the
[Railway guardian deployment runbook](RAILWAY_GUARDIAN.md).

## Start

Load the environment through the process manager or shell, then run:

```bash
npm run guardian:start
```

The first cycle backfills every finalized block from `GUARDIAN_START_BLOCK`. Historical requests
are paced by `GUARDIAN_BACKFILL_DELAY_MS` to respect public RPC capacity. Readiness is not reported
until that cycle succeeds. Transient startup failures use bounded exponential retries and then begin
a new cycle from the last durable cursor rather than terminating the process.

## Endpoints

- `GET /healthz`: process liveness.
- `GET /readyz`: readiness; becomes degraded when successful cycles become stale.
- `GET /metrics`: Prometheus text metrics for the finalized cursor, active policies, confirmed
  executions, simulation failures, submission failures, RPC failures, and last successful cycle.

Logs are newline-delimited JSON. Fields whose names indicate keys, passwords, secrets, seed phrases,
or mnemonics are redacted before serialization.

## Restart and recovery

The state file is written through an atomic rename after each finalized block range. On restart, the
guardian resumes at `lastProcessedBlock + 1`. Event transitions are ordered by `(blockNumber,
logIndex)` and applied idempotently.

If a transaction was submitted before shutdown, its hash is stored as `submitted`. The restarted
guardian reconciles that receipt before considering another submission for the policy.

If the local state is lost or corrupt:

1. Stop the guardian.
2. Preserve the damaged file for diagnosis.
3. Start with no state file and the original deployment block.
4. Let the guardian rebuild its complete projection from finalized Arc logs.

The projection is never authoritative. `ProtectionManager.getPolicy` and `getPolicyValue` are read
again before execution, and the contract revalidates status, expiry, trigger value, beneficiary, and
minimum returned assets during the transaction.

## Failure behavior

- RPC read failure: retry with bounded exponential backoff, increment the RPC failure metric, and do
  not advance an unprocessed cursor.
- Value read failure: leave the policy active locally, record the failure, and try again later.
- Simulation failure: do not submit a transaction.
- Reverted exit: keep the policy active and expose the failure metric.
- Guardian outage: any other keeper can call the permissionless exit when the contract's trigger is
  valid.
- Expired policy: do not execute the downside path; the permissionless expiry close remains available.

## Mainnet switch

Set `GUARDIAN_CHAIN_ID=5042`, use the mainnet manager deployment block and address, and provide a
managed Arc mainnet RPC endpoint. Mainnet operation must use a new low-value keeper and the final
capped, verified deployment from Milestone 6.
