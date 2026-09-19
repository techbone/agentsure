# ADR-0001: Protect positions at entry

Status: Accepted
Date: 2026-09-19

## Context

AgentSure needs to exit a position automatically after a deterministic loss threshold is breached. If the position remains directly inside the user's wallet, AgentSure would need either the user's wallet session, an unrestricted approval, or a wallet-native delegated permission model that can reliably authorize the exact exit.

Circle Agent Wallet policies provide transfer limits and contract allowlists, but wallet-level policy is not the same as isolated per-process authority between a financial agent and a separate guardian.

## Decision

V1 protects only positions opened through AgentSure's PolicyManager. The manager deposits into an approved ERC-4626 vault, holds the resulting shares for the policy, and can redeem those exact shares only to the immutable beneficiary.

## Consequences

- AgentSure can guarantee that a valid onchain trigger is executable without controlling the user's wallet.
- The protected path is composable and auditable.
- Existing arbitrary wallet positions cannot be protected in V1.
- The PolicyManager becomes security-critical and requires strict caps, tests, and an audit before meaningful value is accepted.
