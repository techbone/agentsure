# AgentSure

**The programmable safety layer for autonomous money.**

AgentSure lets an autonomous agent open a protected onchain position with an objective downside rule. A separate risk guardian monitors the position and, when the rule is breached, triggers an onchain exit back to USDC.

AgentSure V1 is **automated risk protection**, not insurance. The protection fee pays for monitoring and execution; it does not promise reimbursement for losses. Funded insurance pools and parametric payouts are a later protocol phase.

## MVP thesis

> A Circle Agent Wallet opens a USDC position through AgentSure. If the position's redeemable value falls below the user's predefined threshold during the coverage window, AgentSure exits the position and returns the remaining USDC to the user's wallet.

The MVP proves one complete Arc-native lifecycle:

1. A Circle Agent Wallet authorizes only the USDC and AgentSure contracts.
2. The wallet opens a protected USDC position and pays a small protection fee.
3. The onchain policy records the principal, trigger, beneficiary, and expiry.
4. The AgentSure guardian monitors finalized Arc state.
5. A measurable loss breaches the threshold.
6. Any keeper can call the deterministic exit function.
7. The contract redeems the position directly to the beneficiary.
8. The dashboard shows the policy, transaction proofs, trigger, and settlement.

## Product boundaries

- No custody of user wallet keys.
- No unrestricted access to the user's Circle Agent Wallet.
- No discretionary claims process.
- No claim of guaranteed stop-loss execution.
- No insurance or reimbursement promise in V1.
- No protection for positions that were not opened through AgentSure in V1.

## Current status

Milestones 0 through 5 are complete. The architecture is locked, the engineering foundation is
tested, the bounded V1 contracts are source-verified on Arc Testnet, a Circle Agent Wallet has
completed a protected lifecycle, and the reviewer-facing product surface turns that engineering
into a live, verifiable policy flow.

- npm workspace with pinned Node, npm, TypeScript, Biome, Vitest, viem, and Zod versions.
- Official Arc Foundry toolchain installed through a checksum-verified, pinned installer.
- Arc chain constants and unit-safe USDC helpers covered by tests.
- Harmless `ArcCallProbe` contract compiled and tested with the Arc toolchain.
- Circle Agent Wallet contract execution proven in a finalized, zero-value Arc Testnet transaction.
- `ProtectionManager` and the explicitly demo-only `DemoRiskVault` deployed with small testnet caps.
- Unit, fuzz, invariant, and adversarial contract tests cover policy lifecycle and settlement boundaries.
- Slither static analysis is pinned and run against upstream Solidity 0.8.30 alongside Arc Foundry tests.
- Guardian indexes finalized Arc events with an atomic, restart-safe cursor and deterministic ordering.
- Guardian reads authoritative policy value, rejects invalid triggers, and simulates every valid exit
  before its dedicated keeper submits a transaction.
- Pending transactions are reconciled after restart without a duplicate submission, while structured
  logs, liveness, readiness, and Prometheus metrics expose operating state.
- An interruption-safe testnet runner reproduced approval, policy creation, a controlled 3.25% loss,
  automatic execution, direct beneficiary settlement, and a fully emptied vault.
- The responsive product console prepares a bounded policy against finalized Arc state, emits exact
  Circle Agent Wallet calldata without browser custody, monitors live policy state, and links every
  lifecycle proof to the Arc explorer.
- CI covers formatting, linting, type checks, tests, npm audit, and repository secret scanning.

### Run the product locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Preparing an Agent Wallet handoff is read-only:
it verifies live Arc Testnet state and returns exact bounded calls, but it does not sign or submit a
transaction.

### Arc Testnet contracts

- [ProtectionManager](https://explorer.testnet.arc.io/address/0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5): verified; 0.01 USDC fee, 2 USDC maximum principal, 5-minute to 7-day windows, and 1% to 50% downside limits.
- [DemoRiskVault](https://explorer.testnet.arc.io/address/0xa70344cEeA5598B836B148B0d83b19eE988b4599): verified; 10 USDC deposit cap and an explicit owner-only controlled-loss mechanism for the demo.
- [Deployment manifest](packages/contracts/deployments/arc-testnet.json): addresses, transaction proofs, caps, and owner/treasury disclosures.

### Arc Testnet protected lifecycle

Policy `#1` protected a `1 USDC` position with a `3%` downside trigger. After a controlled `3.25%`
loss reduced its value to `0.9675 USDC`, the dedicated AgentSure guardian executed the exit and the
contract returned all `0.9675 USDC` directly to the Circle Agent Wallet beneficiary.

- [Circle Agent Wallet approval](https://explorer.testnet.arc.io/tx/0x6d99c8465ed16c1fcca2a88a32a39740c7149f00291dd7d9bc7d8c21bf79fce1)
- [Protected policy opened](https://explorer.testnet.arc.io/tx/0xb81e0c4c93d0d6db446350a70bc98f53dd3bb12dc8960fd58356f77d11a207e6)
- [Controlled loss](https://explorer.testnet.arc.io/tx/0xa6585bcab8a8d8ba1fb9dd240b20892df6a978b544d24c0cb6c82f4c4140a6ef)
- [Autonomous protection execution](https://explorer.testnet.arc.io/tx/0x620a51c4bb872d3739cb85df22ef6ffe29a9f306dd82303c9162c50bdcd41297)
- [Machine-readable lifecycle evidence](docs/evidence/arc-testnet-lifecycle.json)

- [Architecture](docs/ARCHITECTURE.md)
- [Milestones](docs/MILESTONES.md)
- [ADR-0001: Protect at entry](docs/adr/0001-protect-at-entry.md)
- [ADR-0002: Separate permissionless guardian](docs/adr/0002-separate-permissionless-guardian.md)
- [ADR-0003: Prepare Agent Wallet intents without browser custody](docs/adr/0003-prepare-wallet-intents-server-side.md)
- [Circle Agent Wallet proof runbook](docs/runbooks/CIRCLE_WALLET_PROOF.md)
- [Guardian operations runbook](docs/runbooks/GUARDIAN.md)
- [Testnet lifecycle and recovery runbook](docs/runbooks/TESTNET_LIFECYCLE.md)

## Official references

- [Arc funding and builder demo](https://www.arc.io/drones)
- [Arc Request for Builders](https://www.arc.io/blog/the-unfinished-business-of-finance-machine-commerce-and-global-money)
- [Arc deterministic finality](https://docs.arc.io/arc/concepts/deterministic-finality)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences)
- [Circle Agent Wallets](https://developers.circle.com/agent-stack/agent-wallets)
- [Circle CLI command reference](https://developers.circle.com/agent-stack/circle-cli/command-reference)
