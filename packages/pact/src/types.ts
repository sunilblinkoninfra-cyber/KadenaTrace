import type { ICommand, IUnsignedCommand } from "@kadena/client";
import type { Chain, RiskLevel, SeedType } from "@kadenatrace/shared";

export interface WalletSignerDescriptor {
  accountName: string;
  publicKey: string;
  adapterName?: string;
}

export interface PrepareCaseAnchorInput {
  caseId: string;
  subjectChain: Chain;
  subjectKind: SeedType;
  subjectHash: string;
  metadataHash: string;
  publicUri: string;
  publicUriHash: string;
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
  signer: WalletSignerDescriptor;
  chainId: string;
  networkId: string;
}

export interface PreparedCaseAnchorPayload {
  unsignedCommand: IUnsignedCommand;
  txPreview: string;
  chainId: string;
  networkId: string;
  metadataHash: string;
  subjectHash: string;
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
