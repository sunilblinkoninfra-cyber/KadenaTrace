import { readKeyset } from "@kadena/client";

import { FRAUD_REGISTRY_MODULE, TRACE_REGISTRY_MODULE } from "./contracts.js";

interface CreateCaseCommandInput {
  caseId: string;
  traceHash: string;
  metadataHash: string;
  timestamp: string;
  investigator: string;
}

interface AttestationCommandInput {
  caseId: string;
  wallet: string;
  riskScore: number;
  timestamp: string;
  signer: string;
}

function quote(value: string) {
  return JSON.stringify(value);
}

export function buildCreateCaseCommand(input: CreateCaseCommandInput) {
  return `(${TRACE_REGISTRY_MODULE}.create-case ${quote(input.caseId)} ${quote(input.traceHash)} ${quote(
    input.metadataHash
  )} ${quote(input.timestamp)} ${quote(input.investigator)} ${readKeyset(
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
  return `(${TRACE_REGISTRY_MODULE}.attest-wallet-risk ${quote(input.caseId)} ${quote(input.wallet)} ${Math.round(
    input.riskScore
  )} ${quote(input.timestamp)} ${quote(input.signer)} ${readKeyset("submitter-guard")()})`;
}
