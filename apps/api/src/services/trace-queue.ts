import { Queue } from "bullmq";
import IORedis from "ioredis";

import type { TraceRequest } from "@kadenatrace/shared";
import { QUEUE_NAME } from "@kadenatrace/shared";

export interface TraceJobPayload {
  traceId: string;
  request: TraceRequest;
}

export class BullMqTraceQueue {
  private readonly connection: IORedis;
  private readonly queue: Queue<TraceJobPayload>;

  constructor(redisUrl: string) {
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<TraceJobPayload>(QUEUE_NAME, {
      connection: this.connection
    });
  }

  async enqueue(job: TraceJobPayload): Promise<void> {
    await this.queue.add("trace", job);
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}

