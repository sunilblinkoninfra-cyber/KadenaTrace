import { readFile } from "node:fs/promises";

import type { CaseRecord, TraceRecord } from "@kadenatrace/shared";
import { Pool } from "pg";

import type { CaseRepository, TraceRepository } from "./contracts.js";

export async function createPostgresPool(connectionString: string) {
  const pool = new Pool({ connectionString });
  const schema = await readFile(new URL("../../db/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
  return pool;
}

export class PostgresTraceRepository implements TraceRepository {
  constructor(private readonly pool: Pool) {}

  async save(record: TraceRecord): Promise<void> {
    await this.pool.query(
      `
        insert into trace_runs (id, status, request, result, error, created_at, updated_at)
        values ($1, $2, $3::jsonb, $4::jsonb, $5, $6::timestamptz, $7::timestamptz)
        on conflict (id) do update
        set status = excluded.status,
            request = excluded.request,
            result = excluded.result,
            error = excluded.error,
            updated_at = excluded.updated_at
      `,
      [
        record.id,
        record.status,
        JSON.stringify(record.request),
        record.result ? JSON.stringify(record.result) : null,
        record.error ?? null,
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async update(record: TraceRecord): Promise<void> {
    await this.save(record);
  }

  async findById(id: string): Promise<TraceRecord | null> {
    const result = await this.pool.query("select * from trace_runs where id = $1 limit 1", [id]);
    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      status: row.status,
      request: row.request,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}

export class PostgresCaseRepository implements CaseRepository {
  constructor(private readonly pool: Pool) {}

  async save(record: CaseRecord): Promise<void> {
    await this.pool.query(
      `
        insert into fraud_cases (
          case_id, slug, title, summary, seed, trace_id, trace_hash, trace_snapshot, public_uri,
          metadata_hash, narrative, source_refs, anchor, attestations, created_at, updated_at
        )
        values (
          $1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9,
          $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15::timestamptz, $16::timestamptz
        )
        on conflict (case_id) do update
        set slug = excluded.slug,
            title = excluded.title,
            summary = excluded.summary,
            seed = excluded.seed,
            trace_id = excluded.trace_id,
            trace_hash = excluded.trace_hash,
            trace_snapshot = excluded.trace_snapshot,
            public_uri = excluded.public_uri,
            metadata_hash = excluded.metadata_hash,
            narrative = excluded.narrative,
            source_refs = excluded.source_refs,
            anchor = excluded.anchor,
            attestations = excluded.attestations,
            updated_at = excluded.updated_at
      `,
      [
        record.caseId,
        record.slug,
        record.title,
        record.summary,
        JSON.stringify(record.seed),
        record.traceId,
        record.traceHash,
        JSON.stringify(record.traceSnapshot),
        record.publicUri,
        record.metadataHash,
        record.narrative,
        JSON.stringify(record.sourceRefs),
        record.anchor ? JSON.stringify(record.anchor) : null,
        JSON.stringify(record.attestations),
        record.createdAt,
        record.updatedAt
      ]
    );
  }

  async update(record: CaseRecord): Promise<void> {
    await this.save(record);
  }

  async findById(caseId: string): Promise<CaseRecord | null> {
    const result = await this.pool.query("select * from fraud_cases where case_id = $1 limit 1", [caseId]);
    return result.rowCount ? hydrateCaseRow(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<CaseRecord | null> {
    const result = await this.pool.query("select * from fraud_cases where slug = $1 limit 1", [slug]);
    return result.rowCount ? hydrateCaseRow(result.rows[0]) : null;
  }

  async listPublicCases(): Promise<CaseRecord[]> {
    const result = await this.pool.query("select * from fraud_cases order by updated_at desc");
    return result.rows.map(hydrateCaseRow);
  }
}

function hydrateCaseRow(row: Record<string, unknown>): CaseRecord {
  const traceSnapshot = row.trace_snapshot as CaseRecord["traceSnapshot"];
  return {
    caseId: String(row.case_id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    seed: row.seed as CaseRecord["seed"],
    traceId: String(row.trace_id),
    traceHash: String(row.trace_hash ?? traceSnapshot.traceHash),
    traceSnapshot,
    publicUri: String(row.public_uri),
    metadataHash: String(row.metadata_hash),
    narrative: String(row.narrative),
    sourceRefs: row.source_refs as CaseRecord["sourceRefs"],
    anchor: (row.anchor as CaseRecord["anchor"]) ?? undefined,
    attestations: (row.attestations as CaseRecord["attestations"]) ?? [],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString()
  };
}
