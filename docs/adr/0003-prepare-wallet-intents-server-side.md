# ADR-0003: Prepare Agent Wallet intents without browser custody

Status: Accepted
Date: 2026-09-21

## Context

The AgentSure interface must let a reviewer configure protection while preserving Circle Agent
Wallet's MPC custody boundary. Putting wallet credentials, signing material, or a privileged
guardian key in the browser would collapse that boundary. A purely local preview would also be
misleading because deployed contract limits, vault capacity, and the wallet's USDC balance can
change.

## Decision

The browser sends only the requested policy terms to an AgentSure preparation endpoint. The server
reads finalized Arc state, validates the deployed manager and vault constraints, computes the
minimum acceptable shares, and returns two exact bounded calls:

1. USDC `approve(ProtectionManager, principal + fee)`.
2. `ProtectionManager.openPolicy(vault, principal, minimumShares, lossLimit, duration, beneficiary)`.

The response contains a deterministic intent identifier, calldata, human-readable terms, and Circle
CLI commands. It is a handoff plan, not a signature or transaction. Circle's MPC Agent Wallet
confirms and executes the calls outside the browser. Arc events remain authoritative after
execution.

## Consequences

- The web application never receives wallet credentials or signing keys.
- A draft is clearly distinguished from a plan verified against finalized Arc state.
- Exact authorization prevents an unlimited USDC allowance.
- Preparation cannot guarantee later execution because state can change before the wallet submits.
- The displayed policy number is a preparation-time hint; the emitted onchain policy ID is final.
- Future Agent Wallet integrations can consume the same execution-plan boundary without changing
  the contracts or guardian.
