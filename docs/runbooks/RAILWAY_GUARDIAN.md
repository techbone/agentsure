# Railway Guardian Deployment

The hosted AgentSure guardian is a singleton Arc Mainnet keeper. It uses one dedicated, low-value
signing key to call the permissionless `executeProtection` function. It never receives a Circle
Agent Wallet credential, deployer key, treasury key, or user key.

## Service configuration

Create one Railway service from `techbone/agentsure` with:

- Service name: `agentsure-guardian`
- Branch: `main`
- Root directory: `/` (the guardian consumes shared npm workspaces)
- Start command: `npm run guardian:start`
- Region: EU West / Amsterdam
- Replicas: exactly one
- Healthcheck path: `/readyz`
- Healthcheck timeout: 300 seconds
- Restart policy: On Failure

Railway injects `PORT`; the guardian uses it automatically. The readiness endpoint becomes healthy
only after the guardian has read finalized Arc state successfully.

## Persistent state

Attach one Railway volume to the guardian service at `/data`. Railway injects
`RAILWAY_VOLUME_MOUNT_PATH`, and the guardian stores its atomic cursor at
`/data/guardian-state.json` automatically.

Do not run multiple replicas against the same file volume. The contract prevents a completed policy
from executing twice, but a singleton keeper also avoids duplicate nonce and gas races.

## Variables

Add the following variables to the Railway service:

```text
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
GUARDIAN_BIND_HOST=0.0.0.0
GUARDIAN_CHAIN_ID=5042
GUARDIAN_MANAGER_ADDRESS=0xa70344cEeA5598B836B148B0d83b19eE988b4599
GUARDIAN_START_BLOCK=22171481
GUARDIAN_BLOCK_BATCH_SIZE=2000
GUARDIAN_BACKFILL_DELAY_MS=500
GUARDIAN_POLL_INTERVAL_MS=1000
GUARDIAN_EXIT_SLIPPAGE_BPS=100
GUARDIAN_RETRY_ATTEMPTS=6
GUARDIAN_RETRY_BASE_DELAY_MS=500
```

Add `GUARDIAN_PRIVATE_KEY` separately as a Railway secret. It must be the private key for the
dedicated mainnet guardian address:

```text
0x58E92E6AF85D2F05237B8b948Af185B5e40ab1fC
```

Never paste that private key into chat, a shell argument, a repository file, a build log, or a
non-secret variable. The address above is public; the private key is not.

To reveal the existing encrypted keystore locally, run this only when the Railway secret-value field
is ready:

```bash
.tools/arc-foundry/v0.8.0-1/cast wallet decrypt-keystore \
  packages/contracts/keystores/agentsure-mainnet-guardian
```

Enter the keystore password at the hidden prompt, copy the displayed private key directly into the
Railway `GUARDIAN_PRIVATE_KEY` secret, save it, and clear the terminal scrollback. Do not save the
plaintext key locally.

`PORT` and `RAILWAY_VOLUME_MOUNT_PATH` are platform-provided and must not be added manually.

## Public verification

Generate a Railway domain for the service, then verify:

```bash
curl --fail https://<guardian-domain>/healthz
curl --fail https://<guardian-domain>/readyz
curl --fail https://<guardian-domain>/metrics
```

Expected health responses are `{"status":"ok"}` and `{"status":"ready"}`. Logs should contain an
`AgentSure guardian started` record with chain ID `5042`, the mainnet manager, and guardian address.
The metrics cursor should advance while confirmed execution count remains stable unless a new policy
breaches its rule.

## Recovery check

After the first healthy deployment, restart the service once. Confirm it reloads
`/data/guardian-state.json`, resumes from the durable cursor, and does not submit another transaction
for already executed policy `#1`.

Official references:

- [Railway shared monorepos](https://docs.railway.com/deployments/monorepo)
- [Railway healthchecks](https://docs.railway.com/deployments/healthchecks)
- [Railway persistent volumes](https://docs.railway.com/volumes)
- [Railway restart policies](https://docs.railway.com/deployments/restart-policy)
