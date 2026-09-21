# AgentSure Delivery Milestones

The microgrant is reviewed on a rolling basis and requires a live Arc mainnet deployment, a public repository, and an openable product link. Testnet-only work is not eligible.

Target submission: **October 10, 2026**
Program deadline: **October 14, 2026 at 23:59 ET**

## Milestone 0 — Thesis and architecture

Target: September 19
Status: Complete

Exit criteria:

- Product is positioned as automated protection, not unfunded insurance.
- Protect-at-entry model is accepted.
- User wallet and guardian wallet are separated.
- Onchain state machine and trust boundaries are documented.
- Mainnet-compatible demo scenario is defined.

## Milestone 1 — Engineering foundation

Target: September 20–22
Status: Complete

Deliverables:

- Initialize Git repository and workspace tooling.
- Create TypeScript monorepo and Foundry package.
- Pin compiler, Node, package-manager, and dependency versions.
- Add linting, formatting, tests, CI, secret scanning, and environment templates.
- Add Arc mainnet/testnet chain configuration with unit-safe USDC helpers.
- Establish Circle Agent Wallet on testnet and verify a contract call through Circle CLI.

Exit criteria:

- Clean install and test from a fresh checkout.
- CI is green.
- No secret is stored in the repository.
- Circle Agent Wallet can execute a harmless contract call on Arc testnet.

## Milestone 2 — Contracts

Target: September 23–26
Status: Complete

Deliverables:

- `ProtectionManager.sol`.
- `DemoRiskVault.sol`.
- Deployment scripts and address manifest.
- Unit, fuzz, invariant, and malicious-vault tests.
- Static-analysis configuration.

Exit criteria:

- A policy can be opened, triggered, cancelled, and closed after expiry.
- Invalid or premature triggers revert.
- Proceeds can only reach the immutable beneficiary.
- Per-policy share accounting invariants hold.
- Contracts deploy successfully to Arc testnet.

## Milestone 3 — Guardian

Target: September 27–29
Status: Complete

Deliverables:

- Finalized-block/event monitor.
- Restart backfill cursor.
- Policy-value evaluator.
- Transaction simulation and submission.
- Structured logs, health check, and failure metrics.

Exit criteria:

- Guardian restarts without skipping or duplicating a policy.
- A valid breach is executed automatically.
- An invalid breach never reaches transaction submission.
- User wallet credentials are absent from the guardian.

## Milestone 4 — End-to-end testnet proof

Target: September 30–October 2
Status: Complete

Deliverables:

- Exact Circle Agent Wallet USDC allowance and contract vault allowlist configuration.
- Real testnet USDC policy creation.
- Controlled loss event.
- Automatic exit and beneficiary receipt.
- Explorer-linked evidence captured in the README.

Exit criteria:

- One command/script reproduces the complete lifecycle.
- All transaction hashes and state transitions reconcile.
- Failure and recovery runbooks have been exercised once.

Evidence:

- Policy `#1` opened from the Circle Agent Wallet with `1 USDC` principal and a `0.01 USDC` fee.
- A controlled `0.0325 USDC` loss crossed the `0.97 USDC` trigger.
- The dedicated guardian executed the protection transaction and returned `0.9675 USDC` directly
  to the Circle Agent Wallet beneficiary.
- Public-RPC throttling and a terminal interruption were both recovered from without duplicating the
  policy, charging a second fee, or losing the durable event cursor.
- Transaction hashes, block hashes, balance deltas, and final state are preserved in
  `docs/evidence/arc-testnet-lifecycle.json`.

## Milestone 5 — Product surface

Target: October 3–5

Deliverables:

- Policy creation/preview interface.
- Active-policy monitoring view.
- Status timeline and explorer links.
- Clear protection-versus-insurance disclosures.
- Responsive and accessible UI.

Exit criteria:

- A reviewer can understand the product and verify the full flow without reading code.
- The interface never presents offchain data as authoritative.
- Loading, empty, degraded, and failed-execution states are visible.

## Milestone 6 — Mainnet deployment

Target: October 6–8

Deliverables:

- Final capped contract deployment to Arc mainnet.
- Verified source and public deployment manifest.
- 1 USDC live demo policy.
- Hosted guardian and dashboard.

Exit criteria:

- The full controlled breach and exit work on Arc mainnet.
- Product and repository links are public and openable.
- Mainnet caps and treasury ownership are disclosed.

## Milestone 7 — Security and submission

Target: October 9–10

Deliverables:

- Final security checklist and static-analysis report.
- Architecture diagram and developer documentation.
- 60-second demo video.
- Microgrant description and submission.

Exit criteria:

- Submission contains the mainnet app, public repository, concise description, and builder profile.
- Claims in the application match the deployed product exactly.
- Submission is completed by October 10, leaving four days of buffer.

## Buffer — October 11–14

Only bug fixes, reviewer-access issues, and submission corrections. No new product scope.

## Explicitly out of scope for this grant build

- Funded claims or insurance pool.
- Third-party liquidity providers.
- Actuarial pricing.
- Multiple protocol adapters.
- Crosschain protection.
- DAO/governance token.
- Unbounded user deposits.
- Production use before audit and legal review.
