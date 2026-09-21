# Arc Testnet Protected Lifecycle

Milestone 4 proves the complete AgentSure V1 lifecycle using a real Circle Agent Wallet, testnet
USDC, the verified `ProtectionManager`, the explicit demo vault, and an independent encrypted
guardian wallet.

## Reproduce

Install the pinned dependencies and tools, authenticate the Circle CLI for Arc Testnet, and run:

```bash
npm run e2e:testnet
```

The command asks for two local encrypted-keystore passwords. The first unlocks the dedicated
guardian. The second unlocks the testnet deployer solely to invoke the demo vault's controlled-loss
function. Input remains invisible. Neither password nor decrypted key is written to the repository.

The runner performs preflight balance and policy checks, starts the guardian, submits an exact USDC
allowance from the Circle Agent Wallet, opens the policy, creates the controlled loss, waits for the
guardian exit, reconciles every receipt and balance delta, and writes local evidence under `.data/`.

## Proven lifecycle

| Step | Arc Testnet proof |
| --- | --- |
| Exact `1.01 USDC` approval | [`0x6d99…fce1`](https://explorer.testnet.arc.io/tx/0x6d99c8465ed16c1fcca2a88a32a39740c7149f00291dd7d9bc7d8c21bf79fce1) |
| Open `1 USDC` policy | [`0xb81e…07e6`](https://explorer.testnet.arc.io/tx/0xb81e0c4c93d0d6db446350a70bc98f53dd3bb12dc8960fd58356f77d11a207e6) |
| Apply `0.0325 USDC` demo loss | [`0xa658…a6ef`](https://explorer.testnet.arc.io/tx/0xa6585bcab8a8d8ba1fb9dd240b20892df6a978b544d24c0cb6c82f4c4140a6ef) |
| Guardian exits and returns `0.9675 USDC` | [`0x620a…1297`](https://explorer.testnet.arc.io/tx/0x620a51c4bb872d3739cb85df22ef6ffe29a9f306dd82303c9162c50bdcd41297) |

Final state:

- Policy `#1`: `Executed`.
- Trigger value: `0.97 USDC`.
- Value at breach: `0.9675 USDC`.
- Assets returned to the immutable Circle Agent Wallet beneficiary: `0.9675 USDC`.
- Demo vault assets after settlement: `0 USDC`.
- Executor: dedicated guardian `0x8125e77Ef9A7db6Ac0ae13a9139C08044C702523`.

## Exercised recovery

The proof run exercised two real recovery paths:

1. Arc's public RPC throttled historical backfill. The guardian preserved its atomic finalized-block
   cursor, applied paced bounded queries, and resumed without skipping or duplicating an event.
2. The terminal was interrupted after Policy `#1` opened. On restart, the lifecycle runner detected
   the matching active policy, recovered its approval and opening receipts in Arc-compatible
   2,000-block windows, and continued without another approval, policy, or protection fee.

The published evidence is in [`docs/evidence/arc-testnet-lifecycle.json`](../evidence/arc-testnet-lifecycle.json).
