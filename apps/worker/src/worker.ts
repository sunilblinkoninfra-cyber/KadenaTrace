import "dotenv/config";

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg";

import { QUEUE_NAME, type TraceRequest } from "@kadenatrace/shared";

import { TraceRunner } from "./services/trace-runner.js";
import { StorageClient } from "./storage.js";

const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;
const workerPort = Number(process.env.WORKER_PORT ?? 4001);

if (!redisUrl || !databaseUrl) {
  throw new Error("REDIS_URL and DATABASE_URL are required to run the async trace worker.");
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const pool = new Pool({ connectionString: databaseUrl });
const runner = new TraceRunner(new StorageClient(pool));

const worker = new Worker<{ traceId: string; request: TraceRequest }>(
  QUEUE_NAME,
  async (job): Promise<void> => {
    try {
      await runner.run(job.data.traceId, job.data.request);
      logWithTimestamp(`Completed trace job ${job.data.traceId}.`);
    } catch (error) {
      logWithTimestamp(
        `Trace job ${job.data.traceId} failed: ${error instanceof Error ? error.message : "Unknown error."}`
      );
      throw error;
    }
  },
  {
    connection
  }
);

worker.on("ready", (): void => {
  logWithTimestamp("KadenaTrace worker is listening for trace jobs.");
});

worker.on("error", (error: Error): void => {
  logWithTimestamp(`Worker error: ${error.message}`);
});

const healthServer = createServer((request: IncomingMessage, response: ServerResponse): void => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", queue: "connected" }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ status: "not-found" }));
});

healthServer.listen(workerPort, (): void => {
  logWithTimestamp(`Worker health server listening on port ${workerPort}.`);
});

const shutdown = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    healthServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  await worker.close();
  await connection.quit();
  await pool.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function logWithTimestamp(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
