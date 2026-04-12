// MempoolSpaceProvider -- Bitcoin activity provider via mempool.space REST API
import type {
  ActivityProvider,
  ActivityQuery,
  BridgeResolution,
  NormalizedTransfer,
  TransactionQuery
} from "../domain.js";

interface MempoolSpaceProviderOptions {
  baseUrl?: string;
}

interface MempoolAddressTransaction {
  txid: string;
  status?: {
    block_time?: number;
  };
  vin?: Array<{
    prevout?: {
      scriptpubkey_address?: string;
      value?: number;
    };
  }>;
  vout?: Array<{
    scriptpubkey_address?: string;
    value?: number;
  }>;
}

export class MempoolSpaceProvider implements ActivityProvider {
  public readonly name = "mempool-space";
  private readonly baseUrl: string;

  public constructor(options: MempoolSpaceProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://mempool.space").replace(/\/+$/, "");
  }

  public async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    if (query.chain !== "bitcoin") {
      return [];
    }

    const endpoint = `${this.baseUrl}/api/address/${encodeURIComponent(query.address)}/txs`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      return [];
    }

    const transactions = (await response.json()) as MempoolAddressTransaction[];
    return this.toTransfers(transactions, query.address, endpoint).filter((transfer) =>
      this.matchesTimeWindow(transfer, query.fromTime, query.toTime)
    );
  }

  public async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    if (query.chain !== "bitcoin") {
      return [];
    }

    const endpoint = `${this.baseUrl}/api/tx/${encodeURIComponent(query.txHash)}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      return [];
    }

    const transaction = (await response.json()) as MempoolAddressTransaction;
    return this.toTransfers([transaction], undefined, endpoint);
  }

  public async getBridgeResolution(_bridgeTransferId: string): Promise<BridgeResolution | null> {
    return null;
  }

  private toTransfers(
    transactions: MempoolAddressTransaction[],
    queryAddress: string | undefined,
    sourceUrl: string
  ): NormalizedTransfer[] {
    const transfers: NormalizedTransfer[] = [];

    transactions.forEach((transaction) => {
      const from = transaction.vin?.[0]?.prevout?.scriptpubkey_address ?? "coinbase";
      const timestamp = new Date(((transaction.status?.block_time ?? 0) as number) * 1000).toISOString();

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

  private matchesTimeWindow(
    transfer: NormalizedTransfer,
    fromTime: string | undefined,
    toTime: string | undefined
  ): boolean {
    if (fromTime && transfer.timestamp < fromTime) {
      return false;
    }

    if (toTime && transfer.timestamp > toTime) {
      return false;
    }

    return true;
  }
}
