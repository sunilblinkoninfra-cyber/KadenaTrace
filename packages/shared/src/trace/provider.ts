import type {
  ActivityProvider,
  ActivityQuery,
  BridgeResolution,
  NormalizedTransfer,
  TransactionQuery
} from "../domain.js";
import { FIXTURE_BRIDGE_RESOLUTIONS, FIXTURE_TRANSFERS } from "../fixtures/sample-trace.js";
import { normalizeAddress } from "./normalizer.js";
import { MempoolSpaceProvider } from "./mempool-provider.js";
import { KadenaChainwebProvider } from "./kadena-provider.js";

export class FixtureActivityProvider implements ActivityProvider {
  name = "fixture-provider";

  async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    const address = normalizeAddress(query.chain, query.address);

    return FIXTURE_TRANSFERS.filter((transfer) => {
      if (transfer.chain !== query.chain) {
        return false;
      }

      const matchesAddress =
        normalizeAddress(transfer.chain, transfer.from) === address ||
        normalizeAddress(transfer.chain, transfer.to) === address;

      if (!matchesAddress) {
        return false;
      }

      if (query.fromTime && transfer.timestamp < query.fromTime) {
        return false;
      }

      if (query.toTime && transfer.timestamp > query.toTime) {
        return false;
      }

      return true;
    }).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    return FIXTURE_TRANSFERS.filter(
      (transfer) => transfer.chain === query.chain && transfer.txHash.toLowerCase() === query.txHash.toLowerCase()
    ).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  async getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null> {
    return FIXTURE_BRIDGE_RESOLUTIONS.find((resolution) => resolution.bridgeTransferId === bridgeTransferId) ?? null;
  }
}

interface CovalentProviderOptions {
  apiKey?: string;
  baseUrl?: string;
}

interface EvmRpcProviderOptions {
  ethereumRpcUrl?: string;
  bscRpcUrl?: string;
}

interface DefaultProviderOptions {
  covalentApiKey?: string;
  ethereumRpcUrl?: string;
  bscRpcUrl?: string;
  mempoolBaseUrl?: string;
  kadenaGraphUrl?: string;
}

export class CovalentGoldRushProvider implements ActivityProvider {
  name = "covalent-goldrush";
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(options: CovalentProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.covalenthq.com";
  }

  async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    if (!this.apiKey) {
      return [];
    }

    const chain = query.chain === "ethereum" ? "eth-mainnet" : query.chain === "bsc" ? "bsc-mainnet" : query.chain;
    const url = new URL(`${this.baseUrl}/v1/${chain}/address/${query.address}/transfers_v2/`);
    if (query.fromTime) {
      url.searchParams.set("from", query.fromTime);
    }
    if (query.toTime) {
      url.searchParams.set("to", query.toTime);
    }
    url.searchParams.set("key", this.apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      data?: {
        items?: Array<{
          tx_hash?: string;
          block_signed_at?: string;
          transfers?: Array<{
            from_address?: string;
            to_address?: string;
            delta?: number;
            contract_ticker_symbol?: string;
            transfer_type?: string;
          }>;
        }>;
      };
    };

    const transfers: NormalizedTransfer[] = [];
    for (const item of payload.data?.items ?? []) {
      for (const transfer of item.transfers ?? []) {
        if (!transfer.from_address || !transfer.to_address || !item.tx_hash || !item.block_signed_at) {
          continue;
        }

        transfers.push({
          id: `${query.chain}:${item.tx_hash}:${transfer.from_address}:${transfer.to_address}`,
          chain: query.chain,
          txHash: item.tx_hash,
          timestamp: item.block_signed_at,
          from: transfer.from_address,
          to: transfer.to_address,
          asset: transfer.contract_ticker_symbol ?? "UNKNOWN",
          amount: Math.abs(transfer.delta ?? 0),
          transferType:
            transfer.transfer_type === "IN" || transfer.transfer_type === "OUT" ? "token" : "contract",
          source: this.name,
          sourceUrl: url.toString()
        });
      }
    }

    return transfers.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  async getTransactionActivity(_query: TransactionQuery): Promise<NormalizedTransfer[]> {
    return [];
  }

  async getBridgeResolution(_bridgeTransferId: string): Promise<BridgeResolution | null> {
    return null;
  }
}

export class CompositeActivityProvider implements ActivityProvider {
  name = "composite";
  private readonly providers: ActivityProvider[];

  constructor(providers: ActivityProvider[]) {
    this.providers = providers;
  }

  async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    for (const provider of this.providers) {
      try {
        const activity = await provider.listAddressActivity(query);
        if (activity.length > 0) {
          return activity;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    for (const provider of this.providers) {
      try {
        const activity = await provider.getTransactionActivity(query);
        if (activity.length > 0) {
          return activity;
        }
      } catch {
        continue;
      }
    }

    return [];
  }

  async getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null> {
    for (const provider of this.providers) {
      try {
        const resolution = await provider.getBridgeResolution(bridgeTransferId);
        if (resolution) {
          return resolution;
        }
      } catch {
        continue;
      }
    }

    return null;
  }
}

class RoutedActivityProvider implements ActivityProvider {
  public readonly name = "routed-provider";
  private readonly providersByChain: Map<ActivityQuery["chain"], CompositeActivityProvider>;
  private readonly bridgeProviders: CompositeActivityProvider;

  public constructor(routes: Partial<Record<ActivityQuery["chain"], ActivityProvider[]>>, fallbacks: ActivityProvider[]) {
    this.providersByChain = new Map(
      Object.entries(routes).map(([chain, providers]) => [chain as ActivityQuery["chain"], new CompositeActivityProvider(providers ?? [])])
    );
    const bridgeProviders = new Map<string, ActivityProvider>();
    [...fallbacks, ...Object.values(routes).flat()].forEach((provider) => {
      bridgeProviders.set(provider.name, provider);
    });
    this.bridgeProviders = new CompositeActivityProvider(Array.from(bridgeProviders.values()));
  }

  public async listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]> {
    const provider = this.providersByChain.get(query.chain);
    return provider ? provider.listAddressActivity(query) : [];
  }

  public async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    const provider = this.providersByChain.get(query.chain);
    return provider ? provider.getTransactionActivity(query) : [];
  }

  public async getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null> {
    return this.bridgeProviders.getBridgeResolution(bridgeTransferId);
  }
}

export class EvmRpcActivityProvider implements ActivityProvider {
  name = "evm-json-rpc";
  private readonly rpcUrls: Partial<Record<"ethereum" | "bsc", string>>;
  private readonly tokenMetadataCache = new Map<string, Promise<{ symbol: string; decimals: number }>>();

  constructor(options: EvmRpcProviderOptions) {
    this.rpcUrls = {
      ethereum: options.ethereumRpcUrl,
      bsc: options.bscRpcUrl
    };
  }

  async listAddressActivity(_query: ActivityQuery): Promise<NormalizedTransfer[]> {
    return [];
  }

  async getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]> {
    if (query.chain !== "ethereum" && query.chain !== "bsc") {
      return [];
    }

    const chain = query.chain;
    const rpcUrl = this.getRpcUrl(query.chain);
    if (!rpcUrl) {
      return [];
    }

    const [transaction, receipt] = await Promise.all([
      this.rpcRequest<EvmTransaction | null>(rpcUrl, "eth_getTransactionByHash", [query.txHash]),
      this.rpcRequest<EvmTransactionReceipt | null>(rpcUrl, "eth_getTransactionReceipt", [query.txHash])
    ]);

    if (!transaction || !receipt) {
      return [];
    }

    const block = receipt.blockNumber
      ? await this.rpcRequest<EvmBlock>(rpcUrl, "eth_getBlockByNumber", [receipt.blockNumber, false])
      : null;
    const timestamp = block?.timestamp ? hexTimestampToIso(block.timestamp) : new Date().toISOString();
    const transfers: NormalizedTransfer[] = [];
    const blockNumber = receipt.blockNumber ? Number.parseInt(receipt.blockNumber, 16) : undefined;

    if (transaction.from && transaction.to && parseHexToBigInt(transaction.value) > 0n) {
      transfers.push({
        id: `${query.chain}:${query.txHash}:${transaction.from}:${transaction.to}:native`,
        chain,
        txHash: query.txHash,
        timestamp,
        blockNumber,
        from: transaction.from,
        to: transaction.to,
        asset: chain === "bsc" ? "BNB" : "ETH",
        amount: formatUnitsToNumber(parseHexToBigInt(transaction.value), 18),
        transferType: "native",
        source: this.name,
        sourceUrl: rpcUrl
      });
    }

    const erc20Logs = receipt.logs.filter((log) => isErc20TransferLog(log));
    const metadataEntries = await Promise.all(
      Array.from(new Set(erc20Logs.map((log) => normalizeAddress(chain, log.address)))).map(async (address) => [
        address,
        await this.getTokenMetadata(chain, rpcUrl, address)
      ] as const)
    );
    const metadataIndex = new Map(metadataEntries);

    for (const [index, log] of erc20Logs.entries()) {
      const from = topicToAddress(log.topics[1]);
      const to = topicToAddress(log.topics[2]);
      if (!from || !to) {
        continue;
      }

      const metadata = metadataIndex.get(normalizeAddress(chain, log.address)) ?? {
        symbol: shortenContractAddress(log.address),
        decimals: 18
      };
      transfers.push({
        id: `${query.chain}:${query.txHash}:${index}:${from}:${to}:${log.address}`,
        chain,
        txHash: query.txHash,
        timestamp,
        blockNumber,
        from,
        to,
        asset: metadata.symbol,
        amount: formatUnitsToNumber(parseHexToBigInt(log.data), metadata.decimals),
        transferType: "token",
        source: this.name,
        sourceUrl: rpcUrl
      });
    }

    const internalTransfers = await this.getInternalTransfers(chain, rpcUrl, query.txHash, timestamp, blockNumber);

    return [...transfers, ...internalTransfers].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  async getBridgeResolution(_bridgeTransferId: string): Promise<BridgeResolution | null> {
    return null;
  }

  private getRpcUrl(chain: TransactionQuery["chain"]): string | undefined {
    if (chain === "ethereum" || chain === "bsc") {
      return this.rpcUrls[chain];
    }

    return undefined;
  }

  private async getTokenMetadata(chain: "ethereum" | "bsc", rpcUrl: string, address: string) {
    const key = `${chain}:${normalizeAddress(chain, address)}`;
    const existing = this.tokenMetadataCache.get(key);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      const [symbolResult, decimalsResult] = await Promise.allSettled([
        this.rpcRequest<string>(rpcUrl, "eth_call", [{ to: address, data: "0x95d89b41" }, "latest"]),
        this.rpcRequest<string>(rpcUrl, "eth_call", [{ to: address, data: "0x313ce567" }, "latest"])
      ]);

      const symbol =
        symbolResult.status === "fulfilled" ? decodeTokenSymbol(symbolResult.value) : shortenContractAddress(address);
      const decimals =
        decimalsResult.status === "fulfilled" ? decodeTokenDecimals(decimalsResult.value) : 18;

      return {
        symbol: symbol || shortenContractAddress(address),
        decimals
      };
    })();

    this.tokenMetadataCache.set(key, promise);
    return promise;
  }

  private async rpcRequest<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`${method} failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { result?: T; error?: { message?: string } };
    if (payload.error) {
      throw new Error(payload.error.message ?? `${method} failed`);
    }

    return payload.result as T;
  }

  private async getInternalTransfers(
    chain: "ethereum" | "bsc",
    rpcUrl: string,
    txHash: string,
    timestamp: string,
    blockNumber?: number
  ): Promise<NormalizedTransfer[]> {
    try {
      const traces = await this.rpcRequest<EvmTraceEntry[]>(rpcUrl, "trace_transaction", [txHash]);
      const transfers: NormalizedTransfer[] = [];
      traces
        .filter((trace) => trace.type === "call" && (trace.traceAddress?.length ?? 0) > 0)
        .forEach((trace, index) => {
          const from = trace.action?.from;
          const to = trace.action?.to;
          const value = parseHexToBigInt(trace.action?.value);
          if (!from || !to || value <= 0n) {
            return;
          }

          transfers.push({
            id: `${chain}:${txHash}:internal:${index}:${from}:${to}`,
            chain,
            txHash,
            timestamp,
            blockNumber,
            from,
            to,
            asset: chain === "bsc" ? "BNB" : "ETH",
            amount: formatUnitsToNumber(value, 18),
            transferType: "contract",
            source: `${this.name}:trace_transaction`,
            sourceUrl: rpcUrl
          });
        });
      return transfers;
    } catch {
      return [];
    }
  }
}

export function createDefaultActivityProvider(options: DefaultProviderOptions = {}): ActivityProvider {
  const fixtureProvider = new FixtureActivityProvider();
  const covalentProvider = new CovalentGoldRushProvider({ apiKey: options.covalentApiKey });
  const evmRpcProvider = new EvmRpcActivityProvider({
    ethereumRpcUrl: options.ethereumRpcUrl,
    bscRpcUrl: options.bscRpcUrl
  });
  const mempoolBaseUrl = options.mempoolBaseUrl ?? process.env.BITCOIN_MEMPOOL_URL;
  const mempoolProvider = mempoolBaseUrl ? new MempoolSpaceProvider({ baseUrl: mempoolBaseUrl }) : undefined;
  const bitcoinProviders = mempoolProvider ? [mempoolProvider, fixtureProvider] : [fixtureProvider];
  const kadenaProvider = new KadenaChainwebProvider({ graphUrl: options.kadenaGraphUrl ?? process.env.KADENA_GRAPH_URL });

  return new RoutedActivityProvider(
    {
      ethereum: [covalentProvider, evmRpcProvider, fixtureProvider],
      bsc: [covalentProvider, evmRpcProvider, fixtureProvider],
      bitcoin: bitcoinProviders,
      kadena: [kadenaProvider, fixtureProvider]
    },
    [fixtureProvider, covalentProvider, evmRpcProvider, ...(mempoolProvider ? [mempoolProvider] : []), kadenaProvider]
  );
}

interface EvmTransaction {
  from?: string;
  to?: string | null;
  value: string;
}

interface EvmTransactionReceipt {
  blockNumber?: string;
  logs: EvmLog[];
}

interface EvmBlock {
  timestamp: string;
}

interface EvmLog {
  address: string;
  topics: string[];
  data: string;
}

interface EvmTraceEntry {
  type?: string;
  action?: {
    from?: string;
    to?: string;
    value?: string;
  };
  traceAddress?: number[];
}

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function isErc20TransferLog(log: EvmLog) {
  return log.topics.length >= 3 && log.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC;
}

function topicToAddress(topic?: string): string | null {
  if (!topic || topic.length < 40) {
    return null;
  }

  return `0x${topic.slice(-40)}`;
}

function parseHexToBigInt(value: string | undefined) {
  if (!value || value === "0x") {
    return 0n;
  }

  return BigInt(value);
}

function hexTimestampToIso(value: string) {
  const seconds = Number.parseInt(value, 16);
  return new Date(seconds * 1000).toISOString();
}

function formatUnitsToNumber(raw: bigint, decimals: number) {
  if (decimals <= 0) {
    return Number(raw);
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fractional = raw % divisor;
  const fractionalText = fractional
    .toString()
    .padStart(decimals, "0")
    .slice(0, 6)
    .replace(/0+$/, "");

  return Number(fractionalText ? `${whole}.${fractionalText}` : whole.toString());
}

function decodeTokenDecimals(value: string | undefined) {
  if (!value || value === "0x") {
    return 18;
  }

  return Number.parseInt(value, 16);
}

function decodeTokenSymbol(value: string | undefined) {
  if (!value || value === "0x") {
    return "";
  }

  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (normalized.length === 64) {
    return decodeHexAscii(normalized);
  }

  if (normalized.length >= 192) {
    const length = Number.parseInt(normalized.slice(64, 128), 16);
    if (length > 0) {
      return decodeHexAscii(normalized.slice(128, 128 + length * 2));
    }
  }

  return decodeHexAscii(normalized);
}

function decodeHexAscii(value: string) {
  const pairs = value.match(/.{1,2}/g) ?? [];
  return pairs
    .map((pair) => Number.parseInt(pair, 16))
    .filter((code) => Number.isFinite(code) && code > 0)
    .map((code) => String.fromCharCode(code))
    .join("")
    .trim();
}

function shortenContractAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
