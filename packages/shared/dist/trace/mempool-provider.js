export class MempoolSpaceProvider {
    name = "mempool-space";
    baseUrl;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? "https://mempool.space").replace(/\/+$/, "");
    }
    async listAddressActivity(query) {
        if (query.chain !== "bitcoin") {
            return [];
        }
        const endpoint = `${this.baseUrl}/api/address/${encodeURIComponent(query.address)}/txs`;
        const response = await fetch(endpoint);
        if (!response.ok) {
            return [];
        }
        const transactions = (await response.json());
        return this.toTransfers(transactions, query.address, endpoint).filter((transfer) => this.matchesTimeWindow(transfer, query.fromTime, query.toTime));
    }
    async getTransactionActivity(query) {
        if (query.chain !== "bitcoin") {
            return [];
        }
        const endpoint = `${this.baseUrl}/api/tx/${encodeURIComponent(query.txHash)}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
            return [];
        }
        const transaction = (await response.json());
        return this.toTransfers([transaction], undefined, endpoint);
    }
    async getBridgeResolution(_bridgeTransferId) {
        return null;
    }
    toTransfers(transactions, queryAddress, sourceUrl) {
        const transfers = [];
        transactions.forEach((transaction) => {
            const from = transaction.vin?.[0]?.prevout?.scriptpubkey_address ?? "coinbase";
            const timestamp = new Date((transaction.status?.block_time ?? 0) * 1000).toISOString();
            (transaction.vout ?? []).forEach((output, index) => {
                if (!output.scriptpubkey_address || output.scriptpubkey_address === queryAddress) {
                    return;
                }
                transfers.push({
                    id: `bitcoin:${transaction.txid}:${index}`,
                    chain: "bitcoin",
                    txHash: transaction.txid,
                    from,
                    to: output.scriptpubkey_address,
                    amount: Number(((output.value ?? 0) / 1e8).toFixed(8)),
                    asset: "BTC",
                    timestamp,
                    transferType: "native",
                    source: this.name,
                    sourceUrl
                });
            });
        });
        return transfers.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    }
    matchesTimeWindow(transfer, fromTime, toTime) {
        if (fromTime && transfer.timestamp < fromTime) {
            return false;
        }
        if (toTime && transfer.timestamp > toTime) {
            return false;
        }
        return true;
    }
}
