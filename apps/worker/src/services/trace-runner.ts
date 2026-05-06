// TraceRunner -- Executes queued traces and persists their lifecycle updates.
import type { TraceRequest, TraceResult } from "@kadenatrace/shared";
import { TraceEngine } from "@kadenatrace/shared/server";

import { createWorkerProvider } from "../providers/index.js";
import { StorageClient } from "../storage.js";

export class TraceRunner {
  constructor(private readonly storage: StorageClient) {}

  async run(traceId: string, request: TraceRequest): Promise<TraceResult> {
    const engine = new TraceEngine(createWorkerProvider());
    await this.storage.markRunning(traceId, request);

    try {
      const result: TraceResult = await engine.run(request, traceId);
      await this.storage.markCompleted(traceId, request, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Trace execution failed.";
      await this.storage.markFailed(traceId, request, errorMessage);
      throw error;
    }
  }
}
