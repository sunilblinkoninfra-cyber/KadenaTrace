import { readKeyset } from "@kadena/client";
import { FRAUD_REGISTRY_MODULE, TRACE_REGISTRY_MODULE } from "./contracts.js";
function quote(value) {
    return JSON.stringify(value);
}
export function buildCreateCaseCommand(input) {
    return `(${TRACE_REGISTRY_MODULE}.create-case ${quote(input.caseId)} ${quote(input.traceHash)} ${quote(input.metadataHash)} ${quote(input.timestamp)} ${quote(input.investigator)} ${readKeyset("submitter-guard")()})`;
}
export function buildAppendCaseEventCommand(input) {
    return `(${FRAUD_REGISTRY_MODULE}.append-case-event ${quote(input.eventId)} ${quote(input.caseId)} ${quote(input.eventType)} ${quote(input.contentHash)} ${quote(input.signer)} ${readKeyset("submitter-guard")()})`;
}
export function buildAttestationCommand(input) {
    return `(${TRACE_REGISTRY_MODULE}.attest-wallet-risk ${quote(input.caseId)} ${quote(input.wallet)} ${Math.round(input.riskScore)} ${quote(input.timestamp)} ${quote(input.signer)} ${readKeyset("submitter-guard")()})`;
}
export function buildRaiseDisputeCommand(input) {
    return `(${FRAUD_REGISTRY_MODULE}.raise-dispute ${quote(input.disputeId)} ${quote(input.caseId)} ${quote(input.disputer)} ${quote(input.reasonHash)} ${readKeyset("submitter-guard")()})`;
}
