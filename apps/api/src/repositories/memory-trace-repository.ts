import type { TraceRecord } from "@kadenatrace/shared";

import type { TraceRepository } from "./contracts.js";

export class InMemoryTraceRepository implements TraceRepository {
  private readonly records = new Map<string, TraceRecord>();

  async save(record: TraceRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async update(record: TraceRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async findById(id: string): Promise<TraceRecord | null> {
    return this.records.get(id) ?? null;
  }
}

