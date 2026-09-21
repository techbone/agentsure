# AgentSure contracts

This Foundry package targets Arc's EVM semantics through the pinned Arc Foundry toolchain.

## Install the toolchain

```sh
npm run arc:install
```

The installer downloads the official release archive and matching SHA-256 file, verifies the archive, and extracts it into the ignored `.tools/` directory.

## Run the contract checks

```sh
npm run contracts:build
npm run contracts:test
npm run security:install
npm run security:slither
```

`ArcCallProbe.sol` is a value-free Milestone 1 contract used only to verify that a Circle Agent Wallet can call a custom contract on Arc. It is not part of the production AgentSure protocol.

## Deploy the Circle call probe to Arc Testnet

Create the encrypted deployer keystore and fund its public address with Arc Testnet USDC before
running:

```sh
npm run contracts:deploy:probe:testnet
```

Enter the keystore password only in the hidden terminal prompt. The command never requires a raw
private key or writes one to `.env`.

Current verified deployment:

- Contract: `0x09503c928c13ebc01EfB6fD291825020C5e876Ba`
- Transaction: `0xf2ae5b6654f28fd69c7ab99cd2ca66f2e7816a91187fd8cf40e0937ad2009de4`
- [Arc Testnet Explorer](https://explorer.testnet.arc.io/address/0x09503c928c13ebc01EfB6fD291825020C5e876Ba)
- Canonical metadata: `deployments/arc-testnet.json`

## Deploy the Milestone 2 protection contracts to Arc Testnet

First run the read-only live-network simulation:

```sh
npm run contracts:simulate:protection:testnet
```

Then broadcast through the existing encrypted deployer keystore:

```sh
npm run contracts:deploy:protection:testnet
```

The deployment uses Arc USDC and creates a `DemoRiskVault`, a `ProtectionManager`, and one
allowlist transaction. It does not use raw private keys or `.env` secrets.

Current verified deployment:

- [DemoRiskVault](https://explorer.testnet.arc.io/address/0xa70344cEeA5598B836B148B0d83b19eE988b4599)
- [ProtectionManager](https://explorer.testnet.arc.io/address/0x3e4E4A3A5A0f0fb908de6D380d817b6579FFDbF5)
- [Vault deployment transaction](https://explorer.testnet.arc.io/tx/0xb8c5819d9087b58e42dd8e0c05530869369b2816ca5cbb7b6aa50dbf7a62df04)
- [Manager deployment transaction](https://explorer.testnet.arc.io/tx/0x043543f78ddc31ee027c556206a18b80d8cf053b728312f20e40c9e171c2f8e0)
- [Allowlist transaction](https://explorer.testnet.arc.io/tx/0xd4a76a68347a8931ae7fbeff733fd60b242605edf2fad30dda0999a6efeacaee)

The testnet configuration is deliberately bounded: 0.01 USDC fee, 2 USDC maximum policy
principal, 10 USDC vault cap, 5-minute to 7-day windows, and 1% to 50% loss limits. The demo
vault transfers a controlled loss to the disclosed burn address; it is not a yield product or a
production vault.

## Prepare the capped Arc Mainnet deployment

The mainnet script uses the same audited contract bytecode with stricter immutable exposure: a
maximum `1 USDC` policy and a system-wide `1 USDC` demo-vault cap.

```sh
npm run contracts:simulate:protection:mainnet
npm run contracts:deploy:protection:mainnet
```

The first command is read-only. The second uses an encrypted Foundry keystore, broadcasts three
transactions, and submits both contracts for Blockscout source verification. Follow the
[mainnet deployment runbook](../../docs/runbooks/MAINNET_DEPLOYMENT.md) before funding or
broadcasting.
