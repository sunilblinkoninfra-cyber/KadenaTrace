// memory-repository.ts — In-memory TraceRepository + CaseRepository.
// Used when DATABASE_URL is not set. Data is lost on restart.
import type { TraceRecord, CaseRecord } from "@kadenatrace/shared";
import type {
  TraceRepository,
  CaseRepository
} from "./contracts.js";

export class MemoryTraceRepository implements TraceRepository {
  private readonly store = new Map<string, TraceRecord>();

  async save(trace: TraceRecord): Promise<void> {
    this.store.set(trace.id, structuredClone(trace));
  }

  async update(trace: TraceRecord): Promise<void> {
    this.store.set(trace.id, structuredClone(trace));
  }

  async findById(id: string): Promise<TraceRecord | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<TraceRecord[]> {
    return [...this.store.values()].map((v) => structuredClone(v));
  }
}

export class MemoryCaseRepository implements CaseRepository {
  private readonly store = new Map<string, CaseRecord>();

  async save(record: CaseRecord): Promise<void> {
    this.store.set(record.caseId, structuredClone(record));
  }

  async update(record: CaseRecord): Promise<void> {
    this.store.set(record.caseId, structuredClone(record));
  }

  async findById(id: string): Promise<CaseRecord | null> {
    return this.store.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<CaseRecord | null> {
    for (const v of this.store.values()) {
      if (v.slug === slug) {
        return structuredClone(v);
      }
    }
    return null;
  }

  async findAll(): Promise<CaseRecord[]> {
    return [...this.store.values()].map((v) => structuredClone(v));
  }

  async listPublicCases(): Promise<CaseRecord[]> {
    return [...this.store.values()].map((v) => structuredClone(v));
  }
}