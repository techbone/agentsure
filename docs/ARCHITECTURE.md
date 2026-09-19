# AgentSure MVP Architecture

Status: Accepted for implementation
Target: Arc mainnet microgrant submission
Submission target: October 10, 2026
Hard deadline: October 14, 2026 at 23:59 ET

## 1. Goal

Prove that an autonomous wallet can open a bounded USDC position and have a separate autonomous guardian exit it when a deterministic downside rule is breached.

The first user story is:

> Protect 1 USDC for 24 hours. If its redeemable value falls by at least 3%, exit the position and return the remaining USDC to my Circle Agent Wallet.

The production-facing wording is **protection rule** and **protection fee**. The MVP must not call the fee a premium or describe the product as insurance.

## 2. Why Arc is part of the design

AgentSure uses Arc as more than a deployment target:

- USDC is the native gas token, so the agent's operating balance and protected asset use one unit of account.
- Finalized transactions are irreversible in under one second, so the guardian acts after inclusion without confirmation-depth or reorganization logic.
- Circle Agent Wallets can execute contract calls and apply wallet-level transfer and contract policies.
- Arc emits finalized events suitable for an event-driven guardian and audit trail.

Arc exposes USDC through two interfaces over one balance:

- native value: 18 decimals, used for gas and `msg.value`;
- ERC-20 interface: 6 decimals, used by AgentSure for principal, fees, approvals, vault accounting, and UI amounts.

The implementation must never mix raw native-value amounts with raw ERC-20 amounts.

## 3. System context

```text
 User / Parent Financial Agent
              |
              | constrained intent
              v
     Circle Agent Wallet
  (user custody, Circle MPC)
              |
              | approve + openProtectedPosition
              v
   +-------------------------+
   | AgentSure PolicyManager |
   | - collects fee          |
   | - records policy        |
   | - holds vault shares    |
   | - enforces trigger      |
   +------------+------------+
                |
                | ERC-4626 deposit/redeem
                v
       Approved Strategy Vault
                ^
                | previewRedeem(shares)
                |
   +------------+------------+
   | AgentSure Guardian      |
   | - owns no user keys     |
   | - monitors final state  |
   | - submits trigger tx    |
   +------------+------------+
                |
                | permissionless executeProtection
                v
   PolicyManager redeems directly to beneficiary
                |
                v
        Circle Agent Wallet
```

## 4. Trust model

### User wallet

The user's Circle Agent Wallet remains the beneficiary and never exposes its private key to AgentSure. For the demo, its contract allowlist should contain only:

- Arc USDC ERC-20 interface;
- the deployed AgentSure PolicyManager.

The wallet approves a bounded USDC amount and calls the manager. It does not grant the guardian access to the wallet session.

### PolicyManager

The PolicyManager temporarily owns the ERC-4626 shares for each protected position. It may only:

- enter governance-approved vaults;
- redeem the exact shares recorded for a policy;
- return proceeds to the policy beneficiary;
- route the declared protection fee to the treasury;
- pause new positions or exits through narrowly separated emergency controls.

The contract is the source of truth. The database and dashboard are projections only.

### Guardian

The guardian has its own low-value operator wallet. It does not hold user funds or user credentials. `executeProtection(policyId)` is permissionless, so a second keeper or the user can execute the same valid action if the primary guardian is unavailable.

The contract—not the guardian—decides whether the objective trigger is satisfied. A compromised guardian can waste its own gas but cannot redirect proceeds or force an invalid protected exit.

### Treasury

The protection fee is protocol revenue sent to a dedicated treasury address. Treasury funds are not claim capital and must never be presented as an insurance pool. The production treasury should be a multisig; the MVP may begin with a clearly disclosed founder-controlled address and migrate before meaningful value is accepted.

## 5. Onchain components

### ProtectionManager

One auditable contract owns the V1 policy lifecycle.

Suggested policy record:

```text
owner             Circle Agent Wallet that created the policy
beneficiary       Address that receives redeemed USDC
vault             Approved ERC-4626 strategy vault
principalAssets   USDC deposited, 6 decimals
shares            Vault shares held for this policy
triggerAssets     Maximum redeemable value at which exit is allowed
openedAt          Creation timestamp
expiresAt         Protection-window expiry
status            Active | Executed | Cancelled | Expired
```

Required external operations:

- `openPolicy(...)`: collect principal and fee, enter the vault, record exact received shares.
- `executeProtection(policyId)`: if active, unexpired, and `previewRedeem(shares) <= triggerAssets`, redeem directly to the beneficiary.
- `cancelPolicy(policyId)`: owner-controlled early exit to the beneficiary.
- `closeExpiredPolicy(policyId)`: permissionless close after expiry to prevent funds becoming stuck.
- `getPolicyValue(policyId)`: current deterministic redeemable value.

Required protections:

- OpenZeppelin `SafeERC20`, `ReentrancyGuard`, `Pausable`, and two-step ownership or role separation.
- Allowlisted vaults only.
- Checks-effects-interactions ordering.
- Exact share accounting per policy.
- Beneficiary is immutable after opening in V1.
- Maximum duration and loss-threshold bounds.
- Slippage/minimum-assets guard on entry and exit where the vault supports it.
- No admin function that can transfer user principal or policy shares.
- Events for every state transition.

### DemoRiskVault

The grant requires a working Arc mainnet deployment. A clearly labeled demo ERC-4626 vault will create a controlled, tiny, measurable loss event so the full lifecycle can be demonstrated deterministically on mainnet.

Constraints:

- Uses real Arc USDC through its 6-decimal ERC-20 interface.
- Accepts only tiny capped deposits.
- Has an explicit demo-only loss simulation method.
- Emits the before/after exchange rate and transferred loss amount.
- Sends simulated loss to a disclosed sink address; it does not pretend the value vanished.
- Must never be marketed as a yield product or production vault.

The mainnet demo amount is 1 USDC. A 3.25% controlled loss is enough to breach a 3% rule while limiting real economic exposure.

### Future adapters

V1 uses ERC-4626 directly because `previewRedeem` gives an objective onchain position value. Later versions add audited adapters for swaps, lending protocols, rebalances, x402 service escrows, and non-ERC-4626 positions.

## 6. Offchain components

### Guardian service

A small TypeScript service using Viem:

1. subscribes to Arc finalized blocks and `PolicyOpened` events;
2. backfills from the last processed block after restart;
3. queries `getPolicyValue` for active policies;
4. simulates `executeProtection` before submission;
5. submits the transaction from a dedicated keeper wallet;
6. records the final transaction hash and outcome.

Operational rules:

- Order events by `(blockNumber, logIndex)`, never timestamp.
- No reorg rollback or multi-confirmation delay on Arc.
- Make work idempotent: the contract status prevents double execution.
- Use bounded retries with exponential backoff for RPC or submission failures.
- Expose health, last-finalized-block, active-policy count, and execution-failure metrics.
- Keep signing material in a secrets manager; never in source control or browser code.

### Web application

The Next.js dashboard is a control and evidence surface, not the source of truth. It shows:

- Agent Wallet and beneficiary;
- principal and current redeemable value;
- downside threshold and trigger value;
- vault and expiry;
- status timeline;
- protection fee;
- policy, entry, trigger, and exit transaction links;
- plain-language disclosure that V1 exits positions but does not reimburse losses.

Natural-language input may compile a request such as “protect 1 USDC with a 3% downside limit for 24 hours” into a typed policy intent. Any model output must be schema-validated, displayed for confirmation, and enforced by deterministic contract bounds. An LLM must never decide whether a financial trigger occurred.

### Read model

The initial read model may use SQLite locally and Postgres in deployment. It indexes contract events for fast UI queries but can be rebuilt entirely from Arc logs. No balance or policy status stored offchain is authoritative.

## 7. Repository shape

```text
agentsure/
  apps/
    web/                 Next.js dashboard and API boundary
    guardian/            event monitor and transaction executor
  packages/
    contracts/           Foundry project
    chain/               typed ABIs, addresses, Arc configuration
    domain/              shared policy schemas and units
  docs/
    adr/                  architecture decisions
    runbooks/             deployment and incident procedures
  infra/                  deployment configuration, no secrets
```

## 8. Policy lifecycle

```text
Draft
  |
  | wallet approves exact amount and opens policy
  v
Active --------------------------+
  |                              |
  | value <= trigger             | owner cancels
  v                              v
Triggered -> Exit submitted -> Executed
  |
  +-- if window ends first -> Expired/closed
```

Every transition is recorded onchain. The UI may add display states such as `ExecutionPending`, but those are derived and cannot change the contract state machine.

## 9. Failure handling

| Failure | Required behavior |
|---|---|
| Guardian offline | Any caller can execute a valid trigger; alerts fire on stale heartbeat. |
| RPC disconnected | Reconnect, backfill from last finalized block, resume idempotently. |
| Duplicate execution | Contract rejects because policy is no longer Active. |
| Vault read reverts | Do not guess; record degraded status and alert. |
| Exit transaction reverts | Keep policy Active, retry within bounded rules, surface failure. |
| Policy expires | Anyone can close it; proceeds always go to the beneficiary. |
| Admin compromised | Admin cannot redirect active-policy shares or beneficiary proceeds. |
| Treasury compromised | Fee revenue is at risk, not user principal held in active policies. |

## 10. Security and quality gates

Before mainnet deployment:

- Unit tests for every state transition and authorization boundary.
- Fuzz tests for amounts, basis points, deadlines, and share rounding.
- Invariant: total shares recorded across active policies never exceeds manager-held shares for a vault.
- Invariant: exit proceeds can only go to the immutable beneficiary.
- Reentrancy tests with a malicious vault fixture.
- Static analysis with Slither and dependency/version review.
- Fork or Arc-local tests using Arc Foundry for Arc-specific runtime behavior.
- Testnet end-to-end run with real Circle Agent Wallet contract execution.
- Mainnet caps on deposit amount, duration, and approved demo vault.
- Verified source code, deployment manifest, and reproducible commands.

An external audit is required before removing demo caps or accepting meaningful value.

## 11. Sixty-second demo

1. Show a Circle Agent Wallet with slightly more than 1 USDC.
2. Enter: “Protect 1 USDC. Exit at 3% downside for 24 hours.”
3. Show the typed policy preview and protection fee.
4. Open the policy on Arc mainnet and show the explorer transaction.
5. Trigger the demo vault's controlled 3.25% loss.
6. Guardian detects the finalized state and submits the exit.
7. Dashboard changes from `ACTIVE` to `PROTECTION EXECUTED`.
8. Show remaining USDC returned to the same Agent Wallet and link every transaction.

The narration must explicitly say the loss event is controlled for the demo and that V1 automatically exits rather than reimburses.

## 12. Path beyond the MVP

1. Public SDK: `protectERC4626Position(...)` for other Arc agents.
2. Audited adapters for approved Arc protocols and swaps.
3. Multiple independent keepers with execution incentives.
4. Risk scoring, pricing, and protection-fee schedules based on protocol and action risk.
5. Separately capitalized protection pools with solvency controls, verified claims, and parametric payouts.
6. Legal and regulatory review before any insurance language or underwriting activity.
