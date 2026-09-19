# Circle Agent Wallet Contract-Call Proof

Status: Probe deployed and verified; awaiting user-controlled Circle authentication

## Purpose

Prove that a Circle Agent Wallet can execute a custom AgentSure contract call on Arc Testnet without moving principal or granting AgentSure access to a private key.

The proof contract only records the caller, a correlation ID, and the number of calls. It cannot transfer funds.

## Safety boundary

- The user performs Circle email authentication and keeps control of the OTP.
- The Circle CLI session is not stored in this repository.
- Only Arc Testnet is used for this proof.
- The probe call sends no native value.
- No private key, seed phrase, API key, or wallet session is copied into `.env`.

## Prerequisites

1. Build and test `ArcCallProbe` with the pinned Arc Foundry release.
2. Create a dedicated encrypted testnet deployer keystore. Never print or store its private key in
   `.env`.
3. Fund only the deployer's public address with faucet USDC and deploy the probe to Arc Testnet.
4. Verify its source on the Arc Testnet explorer.
5. Run the current official Circle CLI in an isolated operator environment after reviewing its
   dependency audit.
6. Authenticate the user's Circle Agent Wallet with `--testnet`.
7. Fund that wallet from the Circle testnet faucet.

## Proof transaction

Using the deployed probe address and the user's Arc Testnet Agent Wallet address, execute:

```sh
circle wallet execute "record(bytes32)" 0x<32-byte-correlation-id> \
  --contract 0x<probe-contract> \
  --address 0x<agent-wallet> \
  --chain ARC-TESTNET
```

Then verify onchain that:

- `lastCaller()` equals the Circle Agent Wallet address;
- `lastCorrelationId()` equals the submitted value;
- `callCount()` increased by one;
- the transaction sent zero value;
- the explorer shows a successful finalized transaction.

Record the verified contract address and transaction hash in a deployment manifest. Do not record authentication artifacts.
