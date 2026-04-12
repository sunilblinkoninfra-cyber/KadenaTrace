import { readKeyset } from "@kadena/client";
import type { Chain, RiskLevel, SeedType } from "@kadenatrace/shared";

import { FRAUD_REGISTRY_MODULE } from "./contracts.js";

interface CreateCaseCommandInput {
  caseId: string;
  subjectChain: Chain;
  subjectKind: SeedType;
  subjectHash: string;
  metadataHash: string;
  publicUriHash: string;
  reporter: string;
}

interface AttestationCommandInput {
  attestationId: string;
  caseId: string;
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceHash: string;
  signer: string;
}

function quote(value: string) {
  return JSON.stringify(value);
}

export function buildCreateCaseCommand(input: CreateCaseCommandInput) {
  return `(${FRAUD_REGISTRY_MODULE}.create-case ${quote(input.caseId)} ${quote(input.subjectChain)} ${quote(
    input.subjectKind
  )} ${quote(input.subjectHash)} ${quote(input.metadataHash)} ${quote(input.publicUriHash)} ${quote(input.reporter)} ${readKeyset(
    "submitter-guard"
  )()})`;
}

export function buildAppendCaseEventCommand(input: {
  eventId: string;
  caseId: string;
  eventType: string;
  contentHash: string;
  signer: string;
}) {
  return `(${FRAUD_REGISTRY_MODULE}.append-case-event ${quote(input.eventId)} ${quote(input.caseId)} ${quote(
    input.eventType
  )} ${quote(input.contentHash)} ${quote(input.signer)} ${readKeyset("submitter-guard")()})`;
}

export function buildAttestationCommand(input: AttestationCommandInput) {
  return `(${FRAUD_REGISTRY_MODULE}.attest-wallet-risk ${quote(input.attestationId)} ${quote(
    input.caseId
  )} ${quote(input.wallet)} ${quote(input.chain)} ${quote(input.riskLevel)} ${Math.round(input.riskScore)} ${quote(
    input.evidenceHash
  )} ${quote(input.signer)} ${readKeyset("submitter-guard")()})`;
}
