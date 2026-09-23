import { loadGuardianConfig } from "./config.js";
import { PolicyEvaluator } from "./evaluator.js";
import { ProtectionExecutor } from "./executor.js";
import { GuardianHealthServer } from "./health.js";
import { JsonLogger } from "./logger.js";
import { GuardianMetrics } from "./metrics.js";
import { FinalizedPolicyMonitor } from "./monitor.js";
import { GuardianRunner } from "./runner.js";
import { FileGuardianStateStore } from "./store.js";
import { ViemGuardianGateway } from "./viem-gateway.js";

export async function runGuardian(privateKeyOverride?: `0x${string}`): Promise<void> {
  const config = loadGuardianConfig(
    privateKeyOverride === undefined
      ? process.env
      : { ...process.env, GUARDIAN_PRIVATE_KEY: privateKeyOverride },
  );
  const logger = new JsonLogger(console.log, config.logLevel);
  const metrics = new GuardianMetrics();
  const store = new FileGuardianStateStore(config.statePath);
  const chain = new ViemGuardianGateway({
    chainId: config.chainId,
    managerAddress: config.managerAddress,
    privateKey: config.privateKey,
    rpcUrl: config.rpcUrl,
  });
  const retry = {
    attempts: config.retryAttempts,
    baseDelayMs: config.retryBaseDelayMs,
    onRetry: (error: unknown, attempt: number, delayMs: number) =>
      logger.warn("operation retry scheduled", { attempt, delayMs, error }),
  };
  const monitor = new FinalizedPolicyMonitor({
    backfillDelayMs: config.backfillDelayMs,
    batchSize: config.blockBatchSize,
    chain,
    logger,
    metrics,
    startBlock: config.startBlock,
    store,
  });
  const evaluator = new PolicyEvaluator({
    chain,
    exitSlippageBps: config.exitSlippageBps,
  });
  const executor = new ProtectionExecutor({ chain, logger, metrics, retry, store });
  const runner = new GuardianRunner({
    evaluator,
    executor,
    logger,
    metrics,
    monitor,
    pollIntervalMs: config.pollIntervalMs,
    retry,
    store,
  });
  const health = new GuardianHealthServer({
    host: config.bindHost,
    metrics,
    port: config.httpPort,
    staleAfterSeconds: Math.max(30, Math.ceil((config.pollIntervalMs * 5) / 1_000)),
  });
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await runner.initialize();
  await health.start();
  try {
    const ready = await runner.waitUntilReady(controller.signal);
    if (ready) {
      health.markReady();
      logger.info("AgentSure guardian started", {
        keeperAddress: chain.keeperAddress,
        chainId: config.chainId,
        managerAddress: config.managerAddress,
        startBlock: config.startBlock,
      });
      await runner.run(controller.signal);
    }
  } finally {
    await health.stop();
  }
  logger.info("AgentSure guardian stopped");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGuardian().catch((error) => {
    new JsonLogger().error("AgentSure guardian failed to start", { error });
    process.exitCode = 1;
  });
}
