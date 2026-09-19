# ADR-0002: Use a separate permissionless guardian

Status: Accepted
Date: 2026-09-19

## Context

Sharing the user's Circle Agent Wallet session with AgentSure would make the guardian part of the user's wallet trust boundary. It would also blur responsibility between the user's financial agent and the protection service.

## Decision

The guardian uses its own low-value operator wallet and never receives user wallet credentials. Protection execution is permissionless; the onchain PolicyManager validates the threshold, expiry, shares, and beneficiary.

## Consequences

- A compromised guardian cannot redirect funds or trigger an invalid exit.
- Guardian outages can be mitigated by additional keepers or direct user execution.
- The operator initially pays execution gas; later versions can reserve a keeper reward from the protection fee.
- The contract, rather than an offchain model, remains the final risk-rule authority.
