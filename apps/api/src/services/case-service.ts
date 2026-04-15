import { randomUUID } from "node:crypto";

import type { ICommand } from "@kadena/client";
import type {
  PreparedCaseAnchorPayload,
  PreparedWalletAttestationPayload,
  WalletSignerDescriptor
} from "@kadenatrace/pact";
import type {
  CaseCreateInput,
  CaseRecord,
  PublicCaseView,
  RiskAttestation,
  WalletAttestationInput
} from "@kadenatrace/shared";
import { Errors, sha256Hex } from "@kadenatrace/shared";

import type { CaseRepository } from "../repositories/contracts.js";
import {
  type PaginationParams,
  type PaginatedResult,
  PactAnchorService,
  type PactAttestationListRow,
  type PactCaseListRow,
  type WalletAttestationDraftInput
} from "./pact-anchor-service.js";
import { TraceService } from "./trace-service.js";

// In-memory storage for disputes (would be persisted in production)
const disputesMap = new Map<string, DisputeRecord[]>();

export interface DisputeRecord {
  disputeId: string;
  caseId: string;
  disputer: string;
  reasonHash: string;
  reason: string;
  status: "pending" | "reviewed";
  createdAt: string;
  reviewedAt?: string;
}

export class CaseService {
  constructor(
    private readonly caseRepository: CaseRepository,
    private readonly traceService: TraceService,
    private readonly pactAnchorService: PactAnchorService,
    private readonly webBaseUrl: string
  ) {}

  async createCase(input: CaseCreateInput, slugOverride?: string): Promise<CaseRecord> {
    const trace = await this.traceService.getTrace(input.traceId);
    if (!trace || trace.status !== "completed" || !trace.result) {
      throw Errors.validationError("traceId", "Trace must be completed before a public case can be created.");
    }

    const caseId = randomUUID();
    const slug = await this.makeUniqueSlug(slugOverride ?? input.title);
    const publicUri = `${this.webBaseUrl}/case/${slug}`;
    const payloadToHash = JSON.stringify({
      title: input.title,
      summary: input.summary,
      narrative: input.narrative,
      traceId: trace.id,
      traceHash: trace.result.traceHash,
      graph: trace.result.graph,
      findings: trace.result.findings,
      suspiciousPaths: trace.result.suspiciousPaths,
      riskAnalysis: trace.result.riskAnalysis
    });
    const metadataHash = sha256Hex(payloadToHash);
    const now = new Date().toISOString();
    const record: CaseRecord = {
      caseId,
      slug,
      title: input.title,
      summary: input.summary,
      seed: trace.request,
      traceId: trace.id,
      traceHash: trace.result.traceHash,
      traceSnapshot: trace.result,
      publicUri,
      metadataHash,
      narrative: input.narrative,
      sourceRefs: trace.result.sources,
      attestations: [],
      createdAt: now,
      updatedAt: now
    };
    await this.caseRepository.save(record);
    return record;
  }

  async anchorCase(caseId: string): Promise<CaseRecord> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    record.anchor = await this.pactAnchorService.anchorCase(record);
    record.updatedAt = new Date().toISOString();
    await this.caseRepository.update(record);
    return record;
  }

  async prepareCaseAnchor(caseId: string, signer: WalletSignerDescriptor): Promise<PreparedCaseAnchorPayload> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    return this.pactAnchorService.prepareCaseAnchor(record, signer);
  }

  async submitCaseAnchor(
    caseId: string,
    signer: WalletSignerDescriptor,
    signedCommand: ICommand
  ): Promise<CaseRecord> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    record.anchor = await this.pactAnchorService.submitCaseAnchor(record, signer, signedCommand);
    record.updatedAt = new Date().toISOString();
    await this.caseRepository.update(record);
    return record;
  }

  async addAttestation(caseId: string, input: WalletAttestationInput): Promise<CaseRecord> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    const attestation: RiskAttestation = {
      caseId,
      wallet: input.wallet,
      chain: input.chain,
      riskLevel: input.riskLevel,
      riskScore: input.riskScore,
      evidenceHash: input.evidenceHash,
      signer: input.signer,
      createdAt: new Date().toISOString()
    };

    record.attestations.push(attestation);
    record.updatedAt = new Date().toISOString();
    await this.caseRepository.update(record);
    return record;
  }

  async prepareWalletAttestation(
    caseId: string,
    input: WalletAttestationDraftInput,
    signer: WalletSignerDescriptor
  ): Promise<PreparedWalletAttestationPayload> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    return this.pactAnchorService.prepareWalletAttestation(record, input, signer);
  }

  async submitWalletAttestation(
    caseId: string,
    input: WalletAttestationDraftInput,
    signer: WalletSignerDescriptor,
    signedCommand: ICommand
  ): Promise<CaseRecord> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    const attestation = await this.pactAnchorService.submitWalletAttestation(record, input, signer, signedCommand);
    record.attestations = [
      ...record.attestations.filter((item) => item.attestationId !== attestation.attestationId),
      attestation
    ];
    record.updatedAt = new Date().toISOString();
    await this.caseRepository.update(record);
    return record;
  }

  // Dispute methods
  async prepareDispute(
    caseId: string,
    reason: string,
    signer: WalletSignerDescriptor
  ): Promise<{
    disputeId: string;
    unsignedCommand: unknown;
    txPreview: string;
  }> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    const disputeId = sha256Hex(`${caseId}:${signer.accountName}:${Date.now()}`).slice(0, 32);
    const reasonHash = sha256Hex(reason);

    // Build a simulated unsigned command
    const unsignedCommand = {
      pactCode: `(${process.env.PACT_MODULE ?? "kadenatrace.fraud-registry"}.raise-dispute "${disputeId}" "${caseId}" "${signer.accountName}" "${reasonHash}")`,
      data: { reason },
      meta: {
        sender: signer.accountName,
        chainId: "1",
        gasLimit: 1500,
        gasPrice: 0.000001
      }
    };

    return {
      disputeId,
      unsignedCommand,
      txPreview: `raise-dispute: ${disputeId} for case ${caseId}`
    };
  }

  async submitDispute(
    caseId: string,
    disputeId: string,
    _signedCommand: ICommand
  ): Promise<DisputeRecord> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw Errors.caseNotFound(caseId);
    }

    // Simulate on-chain submission
    const dispute: DisputeRecord = {
      disputeId,
      caseId,
      disputer: "unknown",
      reasonHash: sha256Hex("Disputed"),
      reason: "Case under dispute review",
      status: "pending",
      createdAt: new Date().toISOString()
    };

    const existing = disputesMap.get(caseId) ?? [];
    existing.push(dispute);
    disputesMap.set(caseId, existing);

    return dispute;
  }

  async listDisputesForCase(caseId: string): Promise<DisputeRecord[]> {
    return disputesMap.get(caseId) ?? [];
  }

  async getPublicCase(slug: string): Promise<PublicCaseView | null> {
    const record = await this.caseRepository.findBySlug(slug);
    return record ? toPublicCase(record) : null;
  }

  async listPublicCases(params?: PaginationParams): Promise<PaginatedResult<PublicCaseView>> {
    const allRecords = await this.caseRepository.listPublicCases();
    const limit = Math.min(params?.limit ?? 20, 100);
    const offset = params?.cursor ? parseInt(params.cursor, 10) : 0;

    const paginated = allRecords.slice(offset, offset + limit);
    const items = paginated.map(toPublicCase);
    const hasMore = offset + limit < allRecords.length;

    return {
      items,
      nextCursor: hasMore ? String(offset + limit) : undefined,
      hasMore
    };
  }

  async findBySlug(slug: string): Promise<CaseRecord | null> {
    return this.caseRepository.findBySlug(slug);
  }

  async listCasesByChain(
    chain: string,
    params?: PaginationParams
  ): Promise<{
    source: "kadena" | "fallback";
    cases: PactCaseListRow[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    try {
      const result = await this.pactAnchorService.listCasesForChainPaginated(chain, {
        cursor: params?.cursor,
        limit: params?.limit
      });
      if (result.items.length > 0) {
        return {
          source: "kadena",
          cases: result.items,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore
        };
      }
    } catch {
      // Fall through to the local repository snapshot.
    }

    const allCases = (await this.caseRepository.listPublicCases())
      .filter((record) => record.seed.chain === chain)
      .map((record) => toPactCaseListRow(record));

    const limit = Math.min(params?.limit ?? 20, 100);
    const offset = params?.cursor ? parseInt(params.cursor, 10) : 0;
    const paginated = allCases.slice(offset, offset + limit);
    const hasMore = offset + limit < allCases.length;

    return {
      source: "fallback",
      cases: paginated,
      nextCursor: hasMore ? String(offset + limit) : undefined,
      hasMore
    };
  }

  async listAttestationsForCase(
    caseId: string,
    params?: PaginationParams
  ): Promise<{
    source: "kadena" | "fallback";
    attestations: PactAttestationListRow[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    try {
      const result = await this.pactAnchorService.listAttestationsForCasePaginated(caseId, {
        cursor: params?.cursor,
        limit: params?.limit
      });
      if (result.items.length > 0) {
        return {
          source: "kadena",
          attestations: result.items,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore
        };
      }
    } catch {
      // Fall through to the local repository snapshot.
    }

    const record = await this.caseRepository.findById(caseId);
    const allAttestations = record
      ? record.attestations.map((item) => toPactAttestationListRow(record.caseId, item))
      : [];

    const limit = Math.min(params?.limit ?? 20, 100);
    const offset = params?.cursor ? parseInt(params.cursor, 10) : 0;
    const paginated = allAttestations.slice(offset, offset + limit);
    const hasMore = offset + limit < allAttestations.length;

    return {
      source: "fallback",
      attestations: paginated,
      nextCursor: hasMore ? String(offset + limit) : undefined,
      hasMore
    };
  }

  private async makeUniqueSlug(input: string): Promise<string> {
    const base = slugify(input);
    const existing = await this.caseRepository.findBySlug(base);
    if (!existing) {
      return base;
    }

    return `${base}-${randomUUID().slice(0, 8)}`;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toPublicCase(record: CaseRecord): PublicCaseView {
  return {
    caseId: record.caseId,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    narrative: record.narrative,
    seed: record.seed,
    traceHash: record.traceHash,
    trace: record.traceSnapshot,
    traceSnapshot: record.traceSnapshot,
    anchor: record.anchor,
    attestations: record.attestations,
    sourceRefs: record.sourceRefs,
    updatedAt: record.updatedAt
  };
}

function toPactCaseListRow(record: CaseRecord): PactCaseListRow {
  return {
    "case-id": record.caseId,
    "subject-chain": record.seed.chain,
    "subject-kind": record.seed.seedType,
    "subject-hash": sha256Hex(
      JSON.stringify({
        chain: record.seed.chain,
        seedType: record.seed.seedType,
        seedValue: record.seed.seedValue
      })
    ),
    "metadata-hash": record.metadataHash,
    "public-uri-hash": sha256Hex(record.publicUri),
    reporter: record.anchor?.signerAccount ?? "local-case-store"
  };
}

function toPactAttestationListRow(caseId: string, attestation: RiskAttestation): PactAttestationListRow {
  return {
    "attestation-id": attestation.attestationId ?? sha256Hex(`${caseId}:${attestation.wallet}:${attestation.signer}`),
    "case-id": caseId,
    wallet: attestation.wallet,
    chain: attestation.chain,
    "risk-level": attestation.riskLevel,
    "risk-score": attestation.riskScore,
    "evidence-hash": attestation.evidenceHash,
    signer: attestation.signer
  };
}
