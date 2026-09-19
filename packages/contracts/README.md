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
