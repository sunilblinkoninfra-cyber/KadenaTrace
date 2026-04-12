export function deriveChainwebBaseUrl(value: string): string {
  const normalized = value.replace(/\/+$/, "");
  const match = normalized.match(/^(https?:\/\/[^/]+\/chainweb\/0\.0)(?:\/[^/]+\/chain\/[^/]+\/pact)?$/i);
  if (match?.[1]) {
    return match[1];
  }

  return normalized;
}

export function buildPactApiUrl(baseUrl: string, networkId: string, chainId: string): string {
  return `${deriveChainwebBaseUrl(baseUrl)}/${networkId}/chain/${chainId}/pact`;
}

