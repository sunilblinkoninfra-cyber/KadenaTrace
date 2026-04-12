import { Pool } from "pg";

import type { TraceRecord, TraceRequest, TraceResult } from "@kadenatrace/shared";

export async function updateTraceStatus(pool: Pool, traceId: string, status: TraceRecord["status"], request?: TraceRequest) {
  await pool.query(
    `
      update trace_runs
      set status = $2,
          request = coalesce($3::jsonb, request),
          updated_at = now()
      where id = $1
    `,
    [traceId, status, request ? JSON.stringify(request) : null]
  );
}

export async function completeTrace(pool: Pool, record: TraceRecord) {
  await pool.query(
    `
      update trace_runs
      set status = $2,
          result = $3::jsonb,
          error = $4,
          updated_at = $5::timestamptz
      where id = $1
    `,
    [record.id, record.status, record.result ? JSON.stringify(record.result) : null, record.error ?? null, record.updatedAt]
  );
}

export class StorageClient {
  constructor(private readonly pool: Pool) {}

  async markRunning(traceId: string, request: TraceRequest): Promise<void> {
    await updateTraceStatus(this.pool, traceId, "running", request);
  }

  async markCompleted(traceId: string, request: TraceRequest, result: TraceResult): Promise<void> {
    await completeTrace(this.pool, {
      id: traceId,
      request,
      status: "completed",
      result,
      createdAt: result.generatedAt,
      updatedAt: new Date().toISOString()
    });
  }

  async markFailed(traceId: string, request: TraceRequest, errorMessage: string): Promise<void> {
    await completeTrace(this.pool, {
      id: traceId,
      request,
      status: "failed",
      error: errorMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}
