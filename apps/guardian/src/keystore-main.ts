import { getAddress } from "viem";
import { runGuardian } from "./main.js";
import { decryptFoundryKeystore } from "./keystore.js";

const repositoryRoot = new URL("../../../", import.meta.url).pathname;
const accountName = process.env.GUARDIAN_KEYSTORE_ACCOUNT ?? "agentsure-testnet-guardian";
const keystoreDirectory =
  process.env.GUARDIAN_KEYSTORE_DIRECTORY ?? `${repositoryRoot}packages/contracts/keystores`;
const castBinary =
  process.env.ARC_CAST_BINARY ?? `${repositoryRoot}.tools/arc-foundry/v0.8.0-1/cast`;
const expectedAddress = process.env.GUARDIAN_EXPECTED_ADDRESS;

const privateKey = await decryptFoundryKeystore({
  accountName,
  castBinary,
  ...(expectedAddress === undefined ? {} : { expectedAddress: getAddress(expectedAddress) }),
  keystoreDirectory,
});

await runGuardian(privateKey);
