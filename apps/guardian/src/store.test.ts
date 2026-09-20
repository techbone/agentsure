import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileGuardianStateStore, createEmptyGuardianState } from "./store.js";
import { TEST_HASH, trackedPolicy } from "./test-helpers.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("file guardian state store", () => {
  it("starts with an empty rebuildable state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentsure-guardian-"));
    temporaryDirectories.push(directory);
    const store = new FileGuardianStateStore(join(directory, "state.json"));

    await expect(store.load()).resolves.toEqual(createEmptyGuardianState());
  });

  it("round-trips bigint policy and execution state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "agentsure-guardian-"));
    temporaryDirectories.push(directory);
    const store = new FileGuardianStateStore(join(directory, "nested", "state.json"));
    const state = createEmptyGuardianState();
    state.lastProcessedBlock = 99n;
    state.policies["1"] = trackedPolicy();
    state.executions["2"] = {
      policyId: 2n,
      status: "confirmed",
      transactionHash: TEST_HASH,
      blockNumber: 101n,
      assetsReturned: 960_000n,
      updatedAt: "2026-09-20T00:00:00.000Z",
    };

    await store.save(state);

    await expect(store.load()).resolves.toEqual(state);
  });
});
