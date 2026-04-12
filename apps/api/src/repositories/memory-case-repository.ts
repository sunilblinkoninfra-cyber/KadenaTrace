import type { CaseRecord } from "@kadenatrace/shared";

import type { CaseRepository } from "./contracts.js";

export class InMemoryCaseRepository implements CaseRepository {
  private readonly records = new Map<string, CaseRecord>();
  private readonly slugs = new Map<string, string>();

  async save(record: CaseRecord): Promise<void> {
    this.records.set(record.caseId, structuredClone(record));
    this.slugs.set(record.slug, record.caseId);
  }

  async update(record: CaseRecord): Promise<void> {
    this.records.set(record.caseId, structuredClone(record));
    this.slugs.set(record.slug, record.caseId);
  }

  async findById(caseId: string): Promise<CaseRecord | null> {
    return this.records.get(caseId) ?? null;
  }

  async findBySlug(slug: string): Promise<CaseRecord | null> {
    const caseId = this.slugs.get(slug);
    return caseId ? this.records.get(caseId) ?? null : null;
  }

  async listPublicCases(): Promise<CaseRecord[]> {
    return Array.from(this.records.values()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}

