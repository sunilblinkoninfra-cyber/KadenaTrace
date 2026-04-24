import type { ICommand, IUnsignedCommand } from "@kadena/client";
import type { Chain, RiskLevel } from "@kadenatrace/shared";

export interface WalletSignerDescriptor {
  accountName: string;
  publicKey: string;
  adapterName?: string;
}

export interface PrepareCaseAnchorInput {
  caseId: string;
  traceHash: string;
  metadataHash: string;
  timestamp: string;
  publicUri: string;
  publicUriHash: string;
  investigator: string;
  signer: WalletSignerDescriptor;
  chainId: string;
  networkId: string;
}

export interface PrepareWalletAttestationInput {
  attestationId: string;
  caseId: string;
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceHash: string;
  timestamp: string;
  signer: WalletSignerDescriptor;
  chainId: string;
  networkId: string;
}

export interface PrepareDisputeInput {
  disputeId: string;
  caseId: string;
  disputer: string;
  reasonHash: string;
  signer: WalletSignerDescriptor;
  chainId: string;
  networkId: string;
}

export interface PreparedCaseAnchorPayload {
  unsignedCommand: IUnsignedCommand;
  txPreview: string;
  chainId: string;
  networkId: string;
  traceHash: string;
  metadataHash: string;
  timestamp: string;
  publicUriHash: string;
  publicUri: string;
  signer: WalletSignerDescriptor;
}

export interface PreparedWalletAttestationPayload {
  unsignedCommand: IUnsignedCommand;
  txPreview: string;
  chainId: string;
  networkId: string;
  attestationId: string;
  evidenceHash: string;
  timestamp: string;
  signer: WalletSignerDescriptor;
}

export interface PreparedDisputePayload {
  unsignedCommand: IUnsignedCommand;
  txPreview: string;
  chainId: string;
  networkId: string;
  disputeId: string;
  caseId: string;
  reasonHash: string;
  signer: WalletSignerDescriptor;
}

export interface CaseAnchorSubmitPayload {
  signedCommand: ICommand;
  signer: WalletSignerDescriptor;
}

export interface WalletAttestationSubmitPayload {
  signedCommand: ICommand;
  signer: WalletSignerDescriptor;
  attestationId: string;
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceHash: string;
  note?: string;
}
