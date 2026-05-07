export class KadenaChainwebProvider {
    name = "kadena-graph";
    graphUrl;
    constructor(options = {}) {
        this.graphUrl = options.graphUrl ?? "https://graph.kadena.network/graphql";
    }
    async executeGql(query, variables) {
        try {
            const response = await fetch(this.graphUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, variables })
            });
            if (!response.ok) {
                console.warn(`[KadenaChainwebProvider] GraphQL request failed: ` +
                    `HTTP ${response.status} from ${this.graphUrl}`);
                return null;
            }
            const payload = (await response.json());
            if (payload.errors && payload.errors.length > 0) {
                console.warn(`[KadenaChainwebProvider] GraphQL errors: ` +
                    payload.errors.map((e) => e.message).join("; "));
                return null;
            }
            return payload;
        }
        catch (err) {
            console.warn(`[KadenaChainwebProvider] Network error: ` +
                (err instanceof Error ? err.message : String(err)));
            return null;
        }
    }
    mapEdgesToTransfers(edges, sourceUrl) {
        const transfers = [];
        for (const edge of edges) {
            const node = edge.node;
            if (!node.requestKey ||
                !node.fromAccount ||
                !node.toAccount ||
                !node.blockTime) {
                console.warn(`[KadenaChainwebProvider] Skipping transfer with missing ` +
                    `required fields. Got: ${JSON.stringify(node)}`);
                continue;
            }
            const rawAmount = typeof node.amount === "number"
                ? node.amount
                : parseFloat(node.amount ?? "0");
            if (isNaN(rawAmount)) {
                console.warn(`[KadenaChainwebProvider] Skipping transfer with ` +
                    `non-numeric amount "${node.amount}" on tx ${node.requestKey}`);
                continue;
            }
            transfers.push({
                id: `kadena:${node.chainId}:${node.requestKey}:${node.fromAccount}:${node.toAccount}`,
                chain: "kadena",
                txHash: node.requestKey,
                from: node.fromAccount,
                to: node.toAccount,
                amount: rawAmount,
                asset: node.moduleName === "coin" ? "KDA" : node.moduleName,
                timestamp: new Date(node.blockTime).toISOString(),
                transferType: "native",
                source: "kadena-graph",
                sourceUrl
            });
        }
        return transfers;
    }
    async listAddressActivity(query) {
        if (query.chain !== "kadena")
            return [];
        const gqlQuery = `
      query AccountTransfers($account: String!) {
        transfers(
          accountName: $account
          orderBy: { blockTime: desc }
          first: 50
        ) {
          edges {
            node {
              requestKey
              amount
              chainId
              blockTime
              fromAccount
              toAccount
              moduleName
            }
          }
        }
      }
    `;
        const payload = await this.executeGql(gqlQuery, {
            account: query.address
        });
        if (!payload)
            return [];
        const edges = payload.data?.transfers?.edges;
        if (!edges || edges.length === 0) {
            if (payload.data?.transfers?.edges === undefined) {
                console.warn(`[KadenaChainwebProvider] Unexpected response shape for ` +
                    `address ${query.address}. ` +
                    `Expected data.transfers.edges. ` +
                    `Got: ${JSON.stringify(payload.data)}`);
            }
            return [];
        }
        return this.mapEdgesToTransfers(edges, this.graphUrl);
    }
    async getTransactionActivity(query) {
        if (query.chain !== "kadena")
            return [];
        const gqlQuery = `
      query TransfersByRequestKey($requestKey: String!) {
        transfers(requestKey: $requestKey, first: 50) {
          edges {
            node {
              requestKey
              amount
              chainId
              blockTime
              fromAccount
              toAccount
              moduleName
            }
          }
        }
      }
    `;
        const payload = await this.executeGql(gqlQuery, {
            requestKey: query.txHash
        });
        if (!payload)
            return [];
        const edges = payload.data?.transfers?.edges;
        if (!edges || edges.length === 0) {
            if (payload.data?.transfers?.edges === undefined) {
                console.warn(`[KadenaChainwebProvider] Unexpected response shape for ` +
                    `tx ${query.txHash}. ` +
                    `Expected data.transfers.edges. ` +
                    `Got: ${JSON.stringify(payload.data)}`);
            }
            return [];
        }
        return this.mapEdgesToTransfers(edges, this.graphUrl);
    }
    async getBridgeResolution(_bridgeTransferId) {
        return null;
    }
}
