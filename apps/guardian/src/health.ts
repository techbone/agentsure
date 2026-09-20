import { createServer, type Server } from "node:http";
import type { GuardianMetrics } from "./metrics.js";

export class GuardianHealthServer {
  readonly #host: string;
  readonly #metrics: GuardianMetrics;
  readonly #port: number;
  readonly #staleAfterSeconds: number;
  #ready = false;
  #server: Server | null = null;

  constructor(options: {
    host: string;
    metrics: GuardianMetrics;
    port: number;
    staleAfterSeconds: number;
  }) {
    this.#host = options.host;
    this.#metrics = options.metrics;
    this.#port = options.port;
    this.#staleAfterSeconds = options.staleAfterSeconds;
  }

  markReady(): void {
    this.#ready = true;
  }

  async start(): Promise<void> {
    if (this.#server !== null) return;
    this.#server = createServer((request, response) => {
      if (request.url === "/healthz") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end('{"status":"ok"}\n');
        return;
      }
      if (request.url === "/readyz") {
        const lastCycleAge =
          Math.floor(Date.now() / 1000) - this.#metrics.lastSuccessfulCycleTimestampSeconds;
        const isReady = this.#ready && lastCycleAge <= this.#staleAfterSeconds;
        response.writeHead(isReady ? 200 : 503, { "content-type": "application/json" });
        response.end(`${JSON.stringify({ status: isReady ? "ready" : "degraded" })}\n`);
        return;
      }
      if (request.url === "/metrics") {
        response.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
        response.end(this.#metrics.toPrometheus());
        return;
      }
      response.writeHead(404, { "content-type": "application/json" });
      response.end('{"error":"not_found"}\n');
    });

    await new Promise<void>((resolve, reject) => {
      this.#server?.once("error", reject);
      this.#server?.listen(this.#port, this.#host, resolve);
    });
  }

  async stop(): Promise<void> {
    if (this.#server === null) return;
    const server = this.#server;
    this.#server = null;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  }
}
