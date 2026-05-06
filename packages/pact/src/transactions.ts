import { Pact, isSignedTransaction, type ChainId, type ICommand, type IUnsignedCommand } from "@kadena/client";
import { sha256Hex } from "@kadenatrace/shared/server";

import { buildAttestationCommand, buildCreateCaseCommand, buildRaiseDisputeCommand } from "./client.js";
import { FRAUD_REGISTRY_MODULE, TRACE_REGISTRY_MODULE } from "./contracts.js";
import type {
  PrepareCaseAnchorInput,
  PrepareDisputeInput,
  PreparedCaseAnchorPayload,
  PreparedDisputePayload,
  PreparedWalletAttestationPayload,
  PrepareWalletAttestationInput
} from "./types.js";

const DEFAULT_GAS_LIMIT = 1200;
const DEFAULT_GAS_PRICE = 0.000001;
const DEFAULT_TTL = 28800;
const READ_ONLY_SENDER = "kadenatrace-query";

function buildGasSignedTransaction(
  code: string,
  input: {
    chainId: string;
    networkId: string;
    senderAccount: string;
    publicKey: string;
    nonce: string;
    creationTime: number;
    capabilities: Array<{ name: string; args?: unknown[] }>;
  }
): IUnsignedCommand {
  return Pact.builder
    .execution(code)
    .addSigner(input.publicKey, (withCapability) => [
      withCapability("coin.GAS"),
      ...input.capabilities.map((capability) => withCapability(capability.name, ...(capability.args ?? [])))
    ])
    .addKeyset("submitter-guard", "keys-all", input.publicKey)
    .setMeta({
      chainId: input.chainId as ChainId,
      senderAccount: input.senderAccount,
      creationTime: input.creationTime,
      gasLimit: DEFAULT_GAS_LIMIT,
      gasPrice: DEFAULT_GAS_PRICE,
      ttl: DEFAULT_TTL
    })
    .setNetworkId(input.networkId)
    .setNonce(input.nonce)
    .createTransaction();
}

export function createAttestationId(input: {
  caseId: string;
  wallet: string;
  chain: string;
  riskLevel: string;
  riskScore: number;
  evidenceHash: string;
  signerAccount: string;
}): string {
  return sha256Hex(
    JSON.stringify({
      caseId: input.caseId,
      wallet: input.wallet,
      chain: input.chain,
      riskLevel: input.riskLevel,
      riskScore: input.riskScore,
      evidenceHash: input.evidenceHash,
      signerAccount: input.signerAccount
    })
  ).slice(0, 64);
}

export function prepareCaseAnchorTransaction(input: PrepareCaseAnchorInput): PreparedCaseAnchorPayload {
  const txPreview = buildCreateCaseCommand({
    caseId: input.caseId,
    traceHash: input.traceHash,
    metadataHash: input.metadataHash,
    timestamp: input.timestamp,
    investigator: input.investigator
  });

  const unsignedCommand = buildGasSignedTransaction(txPreview, {
    chainId: input.chainId,
    networkId: input.networkId,
    senderAccount: input.signer.accountName,
    publicKey: input.signer.publicKey,
    nonce: createCaseAnchorNonce(input),
    creationTime: toCreationTime(input.timestamp),
    capabilities: [{ name: `${TRACE_REGISTRY_MODULE}.CREATE_CASE` }]
  });

  return {
    unsignedCommand,
    txPreview,
    chainId: input.chainId,
    networkId: input.networkId,
    traceHash: input.traceHash,
    metadataHash: input.metadataHash,
    timestamp: input.timestamp,
    publicUriHash: input.publicUriHash,
    publicUri: input.publicUri,
    signer: input.signer
  };
}

export function prepareWalletAttestationTransaction(
  input: PrepareWalletAttestationInput
): PreparedWalletAttestationPayload {
  const txPreview = buildAttestationCommand({
    caseId: input.caseId,
    wallet: input.wallet,
    riskScore: input.riskScore,
    timestamp: input.timestamp,
    signer: input.signer.accountName
  });

  const unsignedCommand = buildGasSignedTransaction(txPreview, {
    chainId: input.chainId,
    networkId: input.networkId,
    senderAccount: input.signer.accountName,
    publicKey: input.signer.publicKey,
    nonce: createWalletAttestationNonce(input),
    creationTime: toCreationTime(input.timestamp),
    capabilities: [{ name: `${TRACE_REGISTRY_MODULE}.ATTEST_RISK` }]
  });

  return {
    unsignedCommand,
    txPreview,
    chainId: input.chainId,
    networkId: input.networkId,
    attestationId: input.attestationId,
    evidenceHash: input.evidenceHash,
    timestamp: input.timestamp,
    signer: input.signer
  };
}

export function prepareDisputeTransaction(input: PrepareDisputeInput): PreparedDisputePayload {
  const txPreview = buildRaiseDisputeCommand({
    disputeId: input.disputeId,
    caseId: input.caseId,
    disputer: input.disputer,
    reasonHash: input.reasonHash
  });

  const unsignedCommand = buildGasSignedTransaction(txPreview, {
    chainId: input.chainId,
    networkId: input.networkId,
    senderAccount: input.signer.accountName,
    publicKey: input.signer.publicKey,
    nonce: createDisputeNonce(input),
    creationTime: Math.floor(Date.now() / 1000),
    capabilities: [{ name: `${FRAUD_REGISTRY_MODULE}.DISPUTE`, args: [input.caseId] }]
  });

  return {
    unsignedCommand,
    txPreview,
    chainId: input.chainId,
    networkId: input.networkId,
    disputeId: input.disputeId,
    caseId: input.caseId,
    reasonHash: input.reasonHash,
    signer: input.signer
  };
}

export function assertSignedCommandMatches(
  signedCommand: ICommand,
  unsignedCommand: IUnsignedCommand
): void {
  if (!isSignedTransaction(signedCommand)) {
    throw new Error("Wallet returned an incomplete Kadena signature payload.");
  }

  if (signedCommand.hash !== unsignedCommand.hash || signedCommand.cmd !== unsignedCommand.cmd) {
    throw new Error("Signed Kadena command does not match the prepared transaction.");
  }
}

function createCaseAnchorNonce(input: PrepareCaseAnchorInput) {
  return `kadenatrace:case:${input.caseId}:${input.signer.accountName}:${input.metadataHash.slice(0, 12)}`;
}

function createWalletAttestationNonce(input: PrepareWalletAttestationInput) {
  return `kadenatrace:attestation:${input.attestationId}:${input.signer.accountName}`;
}

function createDisputeNonce(input: PrepareDisputeInput) {
  return `kadenatrace:dispute:${input.disputeId}:${input.signer.accountName}`;
}

function toCreationTime(timestamp: string): number {
  return Math.floor(Date.parse(timestamp) / 1000);
}

export function buildListCasesForChainCommand(
  chain: string,
  networkId: string,
  chainId: string
): IUnsignedCommand {
  return buildReadOnlyQueryCommand(
    `(${FRAUD_REGISTRY_MODULE}.list-cases-for-chain ${JSON.stringify(chain)})`,
    networkId,
    chainId
  );
}

export function buildListCasesForChainPaginatedCommand(
  chain: string,
  offset: number,
  limit: number,
  networkId: string,
  chainId: string
): IUnsignedCommand {
  return buildReadOnlyQueryCommand(
    `(${FRAUD_REGISTRY_MODULE}.list-cases-for-chain-paginated ${JSON.stringify(chain)} ${offset} ${limit})`,
    networkId,
    chainId
  );
}

export function buildListAttestationsForCaseCommand(
  caseId: string,
  networkId: string,
  chainId: string
): IUnsignedCommand {
  return buildReadOnlyQueryCommand(
    `(${FRAUD_REGISTRY_MODULE}.list-attestations-for-case ${JSON.stringify(caseId)})`,
    networkId,
    chainId
  );
}

export function buildListAttestationsForCasePaginatedCommand(
  caseId: string,
  offset: number,
  limit: number,
  networkId: string,
  chainId: string
): IUnsignedCommand {
  return buildReadOnlyQueryCommand(
    `(${FRAUD_REGISTRY_MODULE}.list-attestations-for-case-paginated ${JSON.stringify(caseId)} ${offset} ${limit})`,
    networkId,
    chainId
  );
}

function buildReadOnlyQueryCommand(code: string, networkId: string, chainId: string): IUnsignedCommand {
  return Pact.builder
    .execution(code)
    .setMeta({
      chainId: chainId as ChainId,
      senderAccount: READ_ONLY_SENDER,
      gasLimit: 0,
      gasPrice: 0,
      ttl: DEFAULT_TTL
    })
    .setNetworkId(networkId)
    .setNonce(`kadenatrace:query:${sha256Hex(`${networkId}:${chainId}:${code}`).slice(0, 16)}`)
    .createTransaction();
}

export function buildGetCasePublicCommand(
  caseId: string,
  networkId: string,
  chainId: string
): IUnsignedCommand {
  const code = `(${FRAUD_REGISTRY_MODULE}.get-case-public ${JSON.stringify(caseId)})`;
  return buildReadOnlyQueryCommand(code, networkId, chainId);
}

export function buildListPublicCasesCommand(
  limit: number,
  offset: number,
  networkId: string,
  chainId: string
): IUnsignedCommand {
  const code = `(${FRAUD_REGISTRY_MODULE}.list-public-cases ${limit} ${offset})`;
  return buildReadOnlyQueryCommand(code, networkId, chainId);
}
