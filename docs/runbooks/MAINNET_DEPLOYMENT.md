# Arc Mainnet Deployment

Milestone 6 deploys the grant demonstration to Arc Mainnet with a one-USDC system-wide vault cap.
The deployment is intentionally unsuitable for meaningful production value until an external audit,
multisig administration, real strategy adapters, and operational review are complete.

## Canonical network configuration

- Chain ID: `5042`
- RPC: `https://rpc.mainnet.arc.io`
- Explorer: `https://explorer.arc.io`
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`
- ERC-20 accounting precision: 6 decimals
- Native gas precision: 18 decimals

The native and ERC-20 interfaces share one USDC balance. Never add them together or present them as
separate assets.

## Immutable deployment bounds

- Maximum policy principal: `1 USDC`
- Total demo-vault deposit cap: `1 USDC`
- Protection fee: `0.01 USDC`
- Protection window: 5 minutes to 7 days
- Downside rule: 1% to 50%
- Approved vaults at deployment: the single demo-only vault
- Demo loss sink: `0x000000000000000000000000000000000000dEaD`

The vault cap limits aggregate exposure, not only each policy. Once one 1 USDC policy is active, the
vault refuses another deposit.

## Wallet separation

Use three separate roles:

1. Founder-controlled deployer/admin/temporary treasury. It deploys the contracts and invokes the
   explicit controlled-loss function for the grant demonstration.
2. A new low-value mainnet guardian keystore. It only pays gas for permissionless protection exits.
3. A Circle Agent Wallet authenticated in the mainnet CLI session. It owns the policy and remains the
   immutable beneficiary.

The guardian and web application never receive Circle credentials.

Prepared mainnet guardian: `0x58E92E6AF85D2F05237B8b948Af185B5e40ab1fC`. Its encrypted
keystore stays local and is excluded from Git.

Verified Circle ARC Agent Wallet: `0x6b9b032be42343944bd383cc3f0a3e4c6120106f`. Circle CLI reports
this address as the authenticated mainnet agent wallet; it owns each policy and receives settlement.

## Read-only preparation

```bash
npm run contracts:build
npm run contracts:test
npm run security:slither
npm run contracts:simulate:protection:mainnet
```

The simulation must report chain `5042`, deploy both contracts, allowlist the vault, and complete
without a broadcast.

## Funding budget

At the September 22, 2026 preflight gas price of `45.6565 gwei`, the three-transaction deployment
simulation estimated approximately `0.22366 USDC`. Start with the smallest practical balances:

- deployer/admin: `0.25 USDC` initially for deployment and the controlled-loss call;
- dedicated guardian: `0.01 USDC` initially for one protection execution and a modest retry margin;
- Circle Agent Wallet: `1.02 USDC` initially for the 1 USDC principal, 0.01 USDC fee, and a small
  transaction margin.

Do not pre-fund above these amounts. Re-run the deployment simulation and use Circle CLI transaction
estimates immediately before each mainnet action. Top up only by the measured shortfall plus a small
margin; gas conditions and sponsorship behavior may change.

## Broadcast and source verification

The broadcast command uses an encrypted Foundry keystore and submits public source verification to
Sourcify. Sourcify provides independent creation/runtime bytecode matching and can forward successful
verification to compatible explorers:

```bash
npm run contracts:deploy:protection:mainnet
```

Enter the keystore password only at the hidden prompt. Never pass it through an argument,
environment variable, chat message, or committed file.

After broadcast:

1. Reconcile all three transaction receipts: vault deployment, manager deployment, and vault
   allowlisting.
2. Read every immutable bound and role directly from Arc.
3. Confirm both explorer contract pages show verified source.
4. Record addresses, blocks, hashes, constructor configuration, owners, treasury, and verification
   state in `packages/contracts/deployments/arc-mainnet.json`.
5. Commit the manifest before starting the 1 USDC lifecycle.

## Mainnet lifecycle

The Circle Agent Wallet must approve exactly `1.01 USDC`, then call `openPolicy` with 1 USDC
principal, a 3% downside limit, a 24-hour duration, and a minimum-share guard. The admin transfers a
disclosed `0.0325 USDC` controlled loss to the immutable sink. The dedicated guardian detects the
finalized breach, executes the permissionless exit, and the manager redeems directly to the Circle
Agent Wallet beneficiary.

Publish the approval, policy, loss, and protection-execution proofs in a separate mainnet evidence
file. Do not overwrite the testnet evidence.

The mainnet lifecycle runner has an explicit real-value safety latch and no mainnet address
defaults. Populate the verified deployment and wallet values in the process environment, then run:

```bash
AGENTSURE_E2E_ACKNOWLEDGE_MAINNET=I_UNDERSTAND npm run e2e:mainnet
```

It refuses to start if the acknowledgement, manager, vault, deployment block, Circle Agent Wallet,
or guardian address is absent. It remains interruption-safe and writes mainnet state/evidence to
separate files from the testnet lifecycle.
