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

Milestones 0 through 3 are complete. The architecture is locked, the engineering foundation is
tested, a Circle Agent Wallet has called AgentSure's verified probe contract, the bounded V1
protection contracts are deployed and source-verified on Arc Testnet, and the independent guardian
is restart-safe and ready for the end-to-end testnet proof.

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
- CI covers formatting, linting, type checks, tests, npm audit, and repository secret scanning.

### Arc Testnet contracts

- [ProtectionManager](https://explorer.testnet.arc.io/address/0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5): verified; 0.01 USDC fee, 2 USDC maximum principal, 5-minute to 7-day windows, and 1% to 50% downside limits.
- [DemoRiskVault](https://explorer.testnet.arc.io/address/0xa70344cEeA5598B836B148B0d83b19eE988b4599): verified; 10 USDC deposit cap and an explicit owner-only controlled-loss mechanism for the demo.
- [Deployment manifest](packages/contracts/deployments/arc-testnet.json): addresses, transaction proofs, caps, and owner/treasury disclosures.

- [Architecture](docs/ARCHITECTURE.md)
- [Milestones](docs/MILESTONES.md)
- [ADR-0001: Protect at entry](docs/adr/0001-protect-at-entry.md)
- [ADR-0002: Separate permissionless guardian](docs/adr/0002-separate-permissionless-guardian.md)
- [Circle Agent Wallet proof runbook](docs/runbooks/CIRCLE_WALLET_PROOF.md)
- [Guardian operations runbook](docs/runbooks/GUARDIAN.md)

## Official references

- [Arc funding and builder demo](https://www.arc.io/drones)
- [Arc Request for Builders](https://www.arc.io/blog/the-unfinished-business-of-finance-machine-commerce-and-global-money)
- [Arc deterministic finality](https://docs.arc.io/arc/concepts/deterministic-finality)
- [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences)
- [Circle Agent Wallets](https://developers.circle.com/agent-stack/agent-wallets)
- [Circle CLI command reference](https://developers.circle.com/agent-stack/circle-cli/command-reference)
