export function deriveChainwebBaseUrl(value) {
    const normalized = value.replace(/\/+$/, "");
    const match = normalized.match(/^(https?:\/\/[^/]+\/chainweb\/0\.0)(?:\/[^/]+\/chain\/[^/]+\/pact)?$/i);
    if (match?.[1]) {
        return match[1];
    }
    return normalized;
}
export function buildPactApiUrl(baseUrl, networkId, chainId) {
    return `${deriveChainwebBaseUrl(baseUrl)}/${networkId}/chain/${chainId}/pact`;
}
