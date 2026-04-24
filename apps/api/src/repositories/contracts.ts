import type { CaseRecord, TraceRecord } from "@kadenatrace/shared";

export interface TraceRepository {
  save(record: TraceRecord): Promise<void>;
  update(record: TraceRecord): Promise<void>;
  findById(id: string): Promise<TraceRecord | null>;
  findAll(): Promise<TraceRecord[]>;
}

export interface CaseRepository {
  save(record: CaseRecord): Promise<void>;
  update(record: CaseRecord): Promise<void>;
  findById(caseId: string): Promise<CaseRecord | null>;
  findBySlug(slug: string): Promise<CaseRecord | null>;
  listPublicCases(): Promise<CaseRecord[]>;
  findAll(): Promise<CaseRecord[]>;
}

