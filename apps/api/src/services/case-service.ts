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
import { sha256Hex } from "@kadenatrace/shared";

import type { CaseRepository } from "../repositories/contracts.js";
import {
  PactAnchorService,
  type PactAttestationListRow,
  type PactCaseListRow,
  type WalletAttestationDraftInput
} from "./pact-anchor-service.js";
import { TraceService } from "./trace-service.js";

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
      throw new Error("Trace must be completed before a public case can be created.");
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
      throw new Error("Case not found.");
    }

    record.anchor = await this.pactAnchorService.anchorCase(record);
    record.updatedAt = new Date().toISOString();
    await this.caseRepository.update(record);
    return record;
  }

  async prepareCaseAnchor(caseId: string, signer: WalletSignerDescriptor): Promise<PreparedCaseAnchorPayload> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw new Error("Case not found.");
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
      throw new Error("Case not found.");
    }

    record.anchor = await this.pactAnchorService.submitCaseAnchor(record, signer, signedCommand);
    record.updatedAt = new Date().toISOString();
    await this.caseRepository.update(record);
    return record;
  }

  async addAttestation(caseId: string, input: WalletAttestationInput): Promise<CaseRecord> {
    const record = await this.caseRepository.findById(caseId);
    if (!record) {
      throw new Error("Case not found.");
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
      throw new Error("Case not found.");
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
      throw new Error("Case not found.");
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

  async getPublicCase(slug: string): Promise<PublicCaseView | null> {
    const record = await this.caseRepository.findBySlug(slug);
    return record ? toPublicCase(record) : null;
  }

  async listPublicCases(): Promise<PublicCaseView[]> {
    const records = await this.caseRepository.listPublicCases();
    return records.map(toPublicCase);
  }

  async findBySlug(slug: string): Promise<CaseRecord | null> {
    return this.caseRepository.findBySlug(slug);
  }

  async listCasesByChain(chain: string): Promise<{ source: "kadena" | "fallback"; cases: PactCaseListRow[] }> {
    try {
      const cases = await this.pactAnchorService.listCasesForChain(chain);
      if (cases.length > 0) {
        return {
          source: "kadena",
          cases
        };
      }
    } catch {
      // Fall through to the local repository snapshot.
    }

    const cases = (await this.caseRepository.listPublicCases())
      .filter((record) => record.seed.chain === chain)
      .map((record) => toPactCaseListRow(record));
    return {
      source: "fallback",
      cases
    };
  }

  async listAttestationsForCase(
    caseId: string
  ): Promise<{ source: "kadena" | "fallback"; attestations: PactAttestationListRow[] }> {
    try {
      const attestations = await this.pactAnchorService.listAttestationsForCase(caseId);
      if (attestations.length > 0) {
        return {
          source: "kadena",
          attestations
        };
      }
    } catch {
      // Fall through to the local repository snapshot.
    }

    const record = await this.caseRepository.findById(caseId);
    return {
      source: "fallback",
      attestations: record ? record.attestations.map((item) => toPactAttestationListRow(record.caseId, item)) : []
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
