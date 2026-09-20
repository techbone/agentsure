import { spawn } from "node:child_process";
import { getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const PRIVATE_KEY_IN_OUTPUT_PATTERN = /0x[0-9a-fA-F]{64}/;

export function extractPrivateKey(decryptionOutput: string): Hex {
  const privateKey = decryptionOutput.match(PRIVATE_KEY_IN_OUTPUT_PATTERN)?.[0];
  if (privateKey === undefined || !PRIVATE_KEY_PATTERN.test(privateKey)) {
    throw new Error("Keystore decryption did not return a valid private key");
  }
  return privateKey as Hex;
}

export async function decryptFoundryKeystore(options: {
  accountName: string;
  castBinary: string;
  expectedAddress?: Address;
  keystoreDirectory: string;
}): Promise<Hex> {
  const decryptionOutput = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      options.castBinary,
      [
        "wallet",
        "decrypt-keystore",
        options.accountName,
        "--keystore-dir",
        options.keystoreDirectory,
      ],
      { stdio: ["inherit", "pipe", "inherit"] },
    );
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Keystore decryption exited with code ${code ?? "unknown"}`));
        return;
      }
      resolve(output.trim());
    });
  });

  const key = extractPrivateKey(decryptionOutput);
  if (
    options.expectedAddress !== undefined &&
    getAddress(privateKeyToAccount(key).address) !== getAddress(options.expectedAddress)
  ) {
    throw new Error("Decrypted keeper address does not match GUARDIAN_EXPECTED_ADDRESS");
  }
  return key;
}
