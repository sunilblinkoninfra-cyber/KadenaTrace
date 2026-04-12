import type { BridgeResolution, KnownEntity, NormalizedTransfer, TraceRequest } from "../domain.js";
import { makeEdgeId, normalizeAddress } from "../trace/normalizer.js";

export const DEMO_WALLET = "0x1111111111111111111111111111111111111111";
export const DEMO_TX = "0x1000000000000000000000000000000000000000000000000000000000000001";
export const NOMAD_DEMO_WALLET = "0x9000000000000000000000000000000000000000";

const fundingSource = "0xcccccccccccccccccccccccccccccccccccccccc";
const attacker = "0x2222222222222222222222222222222222222222";
const mule1 = "0x3333333333333333333333333333333333333333";
const mule2 = "0x4444444444444444444444444444444444444444";
const mule3 = "0x5555555555555555555555555555555555555555";
const mule4 = "0x6666666666666666666666666666666666666666";
const stargateEth = "0x7777777777777777777777777777777777777777";
const mixer = "0x8888888888888888888888888888888888888888";
const bscReceiver = "0x9999999999999999999999999999999999999999";
const exchange = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const bridgeExit = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const nomadBridgeRouter = "0x90000000000000000000000000000000000000a0";
const nomadBridgeLock = "0x9000000000000000000000000000000000000b01";
const nomadMixer = "0x9000000000000000000000000000000000000c01";
const nomadVault1 = "0x9000000000000000000000000000000000000d11";
const nomadVault2 = "0x9000000000000000000000000000000000000d12";
const nomadVault3 = "0x9000000000000000000000000000000000000d13";
const copyExploiter1 = "0x9000000000000000000000000000000000000101";
const copyExploiter2 = "0x9000000000000000000000000000000000000102";
const copyExploiter3 = "0x9000000000000000000000000000000000000103";
const copyExploiter4 = "0x9000000000000000000000000000000000000104";
const copyExploiter5 = "0x9000000000000000000000000000000000000105";
const hopWalletA1 = "0x9000000000000000000000000000000000000201";
const hopWalletA2 = "0x9000000000000000000000000000000000000301";
const hopWalletB1 = "0x9000000000000000000000000000000000000202";
const hopWalletB2 = "0x9000000000000000000000000000000000000302";
const hopWalletC1 = "0x9000000000000000000000000000000000000203";
const hopWalletC2 = "0x9000000000000000000000000000000000000303";
const hopWalletD1 = "0x9000000000000000000000000000000000000204";
const hopWalletD2 = "0x9000000000000000000000000000000000000304";
const hopWalletE1 = "0x9000000000000000000000000000000000000205";
const hopWalletE2 = "0x9000000000000000000000000000000000000305";
const nomadBscExit = "0x9100000000000000000000000000000000000b01";
const nomadBscCollector = "0x9100000000000000000000000000000000000c10";
const nomadBscExchange = "0x9100000000000000000000000000000000000e01";

export const SHADOW_ROUTER_ENTITIES: KnownEntity[] = [
  { chain: "ethereum", address: fundingSource, label: "Funding Wallet", kind: "wallet", tags: ["context"] },
  { chain: "ethereum", address: DEMO_WALLET, label: "Victim Wallet", kind: "wallet", tags: ["victim"] },
  { chain: "ethereum", address: attacker, label: "Attacker Router", kind: "router", tags: ["attacker", "fan-out", "router"] },
  { chain: "ethereum", address: stargateEth, label: "Stargate Bridge", kind: "bridge", tags: ["bridge", "stargate"] },
  {
    chain: "ethereum",
    address: mixer,
    label: "Mixer Contract",
    kind: "mixer",
    tags: ["mixer"],
    terminal: true
  },
  {
    chain: "ethereum",
    address: exchange,
    label: "Exchange Deposit Wallet",
    kind: "exchange",
    tags: ["exchange", "sink"],
    terminal: true
  },
  { chain: "bsc", address: bscReceiver, label: "BSC Receiver", kind: "wallet", tags: ["bridge-beneficiary"] },
  {
    chain: "bsc",
    address: exchange,
    label: "Exchange Deposit Wallet",
    kind: "exchange",
    tags: ["exchange", "sink"],
    terminal: true
  },
  {
    chain: "bsc",
    address: bridgeExit,
    label: "Stargate Exit",
    kind: "bridge",
    tags: ["bridge", "stargate"],
    terminal: true
  }
];

export const NOMAD_ENTITY_INDEX: KnownEntity[] = [
  {
    chain: "ethereum",
    address: nomadBridgeRouter,
    label: "Nomad Router",
    kind: "bridge",
    tags: ["bridge", "nomad"]
  },
  {
    chain: "ethereum",
    address: NOMAD_DEMO_WALLET,
    label: "nomad-bridge-exploiter-0",
    kind: "wallet",
    tags: ["nomad", "seed", "exploiter"]
  },
  {
    chain: "ethereum",
    address: copyExploiter1,
    label: "copy-exploiter-1",
    kind: "wallet",
    tags: ["nomad", "copycat", "fan-out"]
  },
  {
    chain: "ethereum",
    address: copyExploiter2,
    label: "copy-exploiter-2",
    kind: "wallet",
    tags: ["nomad", "copycat", "fan-out"]
  },
  {
    chain: "ethereum",
    address: copyExploiter3,
    label: "copy-exploiter-3",
    kind: "wallet",
    tags: ["nomad", "copycat", "fan-out"]
  },
  {
    chain: "ethereum",
    address: copyExploiter4,
    label: "copy-exploiter-4",
    kind: "wallet",
    tags: ["nomad", "copycat", "fan-out"]
  },
  {
    chain: "ethereum",
    address: copyExploiter5,
    label: "copy-exploiter-5",
    kind: "wallet",
    tags: ["nomad", "copycat", "fan-out"]
  },
  { chain: "ethereum", address: hopWalletA1, label: "hop-wallet-a1", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletA2, label: "hop-wallet-a2", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletB1, label: "hop-wallet-b1", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletB2, label: "hop-wallet-b2", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletC1, label: "hop-wallet-c1", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletC2, label: "hop-wallet-c2", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletD1, label: "hop-wallet-d1", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletD2, label: "hop-wallet-d2", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletE1, label: "hop-wallet-e1", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  { chain: "ethereum", address: hopWalletE2, label: "hop-wallet-e2", kind: "wallet", tags: ["nomad", "rapid-hop"] },
  {
    chain: "ethereum",
    address: nomadBridgeLock,
    label: "Nomad Exit Bridge",
    kind: "bridge",
    tags: ["bridge", "nomad"],
    terminal: true
  },
  {
    chain: "ethereum",
    address: nomadMixer,
    label: "Mixer Cashout",
    kind: "mixer",
    tags: ["mixer", "nomad"],
    terminal: true
  },
  { chain: "ethereum", address: nomadVault1, label: "vault-wallet-1", kind: "wallet", tags: ["nomad", "stash"] },
  { chain: "ethereum", address: nomadVault2, label: "vault-wallet-2", kind: "wallet", tags: ["nomad", "stash"] },
  { chain: "ethereum", address: nomadVault3, label: "vault-wallet-3", kind: "wallet", tags: ["nomad", "stash"] },
  {
    chain: "bsc",
    address: nomadBscExit,
    label: "Nomad BSC Exit",
    kind: "bridge",
    tags: ["bridge", "nomad"],
    terminal: true
  },
  {
    chain: "bsc",
    address: nomadBscCollector,
    label: "bsc-consolidation-wallet",
    kind: "wallet",
    tags: ["nomad", "bridge-beneficiary", "sink"]
  },
  {
    chain: "bsc",
    address: nomadBscExchange,
    label: "Exchange Sink Wallet",
    kind: "exchange",
    tags: ["exchange", "sink", "nomad"],
    terminal: true
  }
];

export const ENTITY_INDEX = {
  shadowRouter: SHADOW_ROUTER_ENTITIES,
  nomadBridge: NOMAD_ENTITY_INDEX
} as const;

export const KNOWN_ENTITIES: KnownEntity[] = [...ENTITY_INDEX.shadowRouter, ...ENTITY_INDEX.nomadBridge];

export const SAMPLE_TRANSFERS: NormalizedTransfer[] = [
  {
    id: "t0",
    chain: "ethereum",
    txHash: "0x0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    timestamp: "2026-03-28T09:58:00.000Z",
    from: fundingSource,
    to: DEMO_WALLET,
    asset: "ETH",
    amount: 25,
    transferType: "native",
    source: "fixture",
    sourceUrl: "https://example.com/fixtures/demo-case/funding"
  },
  {
    id: "t1",
    chain: "ethereum",
    txHash: DEMO_TX,
    timestamp: "2026-03-28T10:00:00.000Z",
    from: DEMO_WALLET,
    to: attacker,
    asset: "ETH",
    amount: 25,
    transferType: "native",
    source: "fixture",
    sourceUrl: "https://example.com/fixtures/demo-case"
  },
  {
    id: "t2",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000002",
    timestamp: "2026-03-28T10:05:00.000Z",
    from: attacker,
    to: mule1,
    asset: "ETH",
    amount: 4,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t3",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000003",
    timestamp: "2026-03-28T10:06:00.000Z",
    from: attacker,
    to: mule2,
    asset: "ETH",
    amount: 6,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t4",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000004",
    timestamp: "2026-03-28T10:09:00.000Z",
    from: attacker,
    to: stargateEth,
    asset: "ETH",
    amount: 5,
    transferType: "native",
    source: "fixture",
    bridgeTransferId: "bridge-eth-bsc-1"
  },
  {
    id: "t5",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000005",
    timestamp: "2026-03-28T10:10:00.000Z",
    from: attacker,
    to: mule3,
    asset: "ETH",
    amount: 5,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t6",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000006",
    timestamp: "2026-03-28T10:12:00.000Z",
    from: attacker,
    to: mule4,
    asset: "ETH",
    amount: 5,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t7",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000007",
    timestamp: "2026-03-28T10:18:00.000Z",
    from: mule1,
    to: mixer,
    asset: "ETH",
    amount: 4,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t8",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000008",
    timestamp: "2026-03-28T10:20:00.000Z",
    from: mule2,
    to: exchange,
    asset: "ETH",
    amount: 6,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t9",
    chain: "ethereum",
    txHash: "0x1000000000000000000000000000000000000000000000000000000000000009",
    timestamp: "2026-03-28T10:22:00.000Z",
    from: mule3,
    to: exchange,
    asset: "ETH",
    amount: 5,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t10",
    chain: "ethereum",
    txHash: "0x100000000000000000000000000000000000000000000000000000000000000a",
    timestamp: "2026-03-28T10:24:00.000Z",
    from: mule4,
    to: exchange,
    asset: "ETH",
    amount: 5,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "t11",
    chain: "bsc",
    txHash: "0x2000000000000000000000000000000000000000000000000000000000000001",
    timestamp: "2026-03-28T10:21:00.000Z",
    from: bridgeExit,
    to: bscReceiver,
    asset: "WBNB",
    amount: 4.8,
    transferType: "synthetic-bridge",
    source: "fixture",
    bridgeTransferId: "bridge-eth-bsc-1"
  },
  {
    id: "t12",
    chain: "bsc",
    txHash: "0x2000000000000000000000000000000000000000000000000000000000000002",
    timestamp: "2026-03-28T10:28:00.000Z",
    from: bscReceiver,
    to: exchange,
    asset: "WBNB",
    amount: 4.7,
    transferType: "token",
    source: "fixture"
  }
];

export const NOMAD_TRACE_TRANSFERS: NormalizedTransfer[] = [
  {
    id: "nomad-0",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000001",
    timestamp: "2022-08-02T00:00:00.000Z",
    from: nomadBridgeRouter,
    to: NOMAD_DEMO_WALLET,
    asset: "ETH",
    amount: 82,
    transferType: "contract",
    source: "fixture",
    sourceUrl: "https://www.nomad.xyz/"
  },
  {
    id: "nomad-1",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000011",
    timestamp: "2022-08-02T00:03:00.000Z",
    from: NOMAD_DEMO_WALLET,
    to: copyExploiter1,
    asset: "ETH",
    amount: 22,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-2",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000012",
    timestamp: "2022-08-02T00:05:00.000Z",
    from: NOMAD_DEMO_WALLET,
    to: copyExploiter2,
    asset: "ETH",
    amount: 18,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-3",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000013",
    timestamp: "2022-08-02T00:07:00.000Z",
    from: NOMAD_DEMO_WALLET,
    to: copyExploiter3,
    asset: "ETH",
    amount: 15,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-4",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000014",
    timestamp: "2022-08-02T00:10:00.000Z",
    from: NOMAD_DEMO_WALLET,
    to: copyExploiter4,
    asset: "ETH",
    amount: 14,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-5",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000015",
    timestamp: "2022-08-02T00:12:00.000Z",
    from: NOMAD_DEMO_WALLET,
    to: copyExploiter5,
    asset: "ETH",
    amount: 13,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-6",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000021",
    timestamp: "2022-08-02T00:16:00.000Z",
    from: copyExploiter1,
    to: hopWalletA1,
    asset: "ETH",
    amount: 21.5,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-7",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000022",
    timestamp: "2022-08-02T00:21:00.000Z",
    from: hopWalletA1,
    to: hopWalletA2,
    asset: "ETH",
    amount: 21.1,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-8",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000023",
    timestamp: "2022-08-02T00:25:00.000Z",
    from: hopWalletA2,
    to: nomadMixer,
    asset: "ETH",
    amount: 20.8,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-9",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000031",
    timestamp: "2022-08-02T00:18:00.000Z",
    from: copyExploiter2,
    to: hopWalletB1,
    asset: "ETH",
    amount: 17.6,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-10",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000032",
    timestamp: "2022-08-02T00:24:00.000Z",
    from: hopWalletB1,
    to: hopWalletB2,
    asset: "ETH",
    amount: 17.2,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-11",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000033",
    timestamp: "2022-08-02T00:29:00.000Z",
    from: hopWalletB2,
    to: nomadBridgeLock,
    asset: "ETH",
    amount: 16.9,
    transferType: "contract",
    source: "fixture",
    bridgeTransferId: "nomad-bridge-hop-1"
  },
  {
    id: "nomad-12",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000041",
    timestamp: "2022-08-02T00:19:00.000Z",
    from: copyExploiter3,
    to: hopWalletC1,
    asset: "ETH",
    amount: 14.7,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-13",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000042",
    timestamp: "2022-08-02T00:26:00.000Z",
    from: hopWalletC1,
    to: hopWalletC2,
    asset: "ETH",
    amount: 14.4,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-14",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000043",
    timestamp: "2022-08-02T00:30:00.000Z",
    from: hopWalletC2,
    to: nomadVault1,
    asset: "ETH",
    amount: 14.1,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-15",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000051",
    timestamp: "2022-08-02T00:22:00.000Z",
    from: copyExploiter4,
    to: hopWalletD1,
    asset: "ETH",
    amount: 13.6,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-16",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000052",
    timestamp: "2022-08-02T00:28:00.000Z",
    from: hopWalletD1,
    to: hopWalletD2,
    asset: "ETH",
    amount: 13.2,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-17",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000053",
    timestamp: "2022-08-02T00:33:00.000Z",
    from: hopWalletD2,
    to: nomadVault2,
    asset: "ETH",
    amount: 12.9,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-18",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000061",
    timestamp: "2022-08-02T00:23:00.000Z",
    from: copyExploiter5,
    to: hopWalletE1,
    asset: "ETH",
    amount: 12.6,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-19",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000062",
    timestamp: "2022-08-02T00:29:00.000Z",
    from: hopWalletE1,
    to: hopWalletE2,
    asset: "ETH",
    amount: 12.2,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-20",
    chain: "ethereum",
    txHash: "0x9000000000000000000000000000000000000000000000000000000000000063",
    timestamp: "2022-08-02T00:34:00.000Z",
    from: hopWalletE2,
    to: nomadVault3,
    asset: "ETH",
    amount: 11.9,
    transferType: "native",
    source: "fixture"
  },
  {
    id: "nomad-21",
    chain: "bsc",
    txHash: "0x9100000000000000000000000000000000000000000000000000000000000011",
    timestamp: "2022-08-02T00:32:00.000Z",
    from: nomadBscExit,
    to: nomadBscCollector,
    asset: "WBNB",
    amount: 16.5,
    transferType: "synthetic-bridge",
    source: "fixture",
    bridgeTransferId: "nomad-bridge-hop-1"
  },
  {
    id: "nomad-22",
    chain: "bsc",
    txHash: "0x9100000000000000000000000000000000000000000000000000000000000012",
    timestamp: "2022-08-02T00:40:00.000Z",
    from: nomadBscCollector,
    to: nomadBscExchange,
    asset: "WBNB",
    amount: 16.1,
    transferType: "token",
    source: "fixture"
  }
];

export const SAMPLE_BRIDGE_RESOLUTIONS: BridgeResolution[] = [
  {
    bridgeTransferId: "bridge-eth-bsc-1",
    sourceChain: "ethereum",
    destinationChain: "bsc",
    sourceBridgeAddress: stargateEth,
    exitAddress: bridgeExit,
    beneficiaryAddress: bscReceiver,
    asset: "WBNB",
    amount: 4.8,
    timestamp: "2026-03-28T10:21:00.000Z",
    resolved: true,
    sourceUrl: "https://example.com/fixtures/bridge/bridge-eth-bsc-1"
  }
];

export const NOMAD_BRIDGE_RESOLUTIONS: BridgeResolution[] = [
  {
    bridgeTransferId: "nomad-bridge-hop-1",
    sourceChain: "ethereum",
    destinationChain: "bsc",
    sourceBridgeAddress: nomadBridgeLock,
    exitAddress: nomadBscExit,
    beneficiaryAddress: nomadBscCollector,
    asset: "WBNB",
    amount: 16.5,
    timestamp: "2022-08-02T00:32:00.000Z",
    resolved: true,
    sourceUrl: "https://www.nomad.xyz/"
  }
];

export const FIXTURE_TRANSFERS: NormalizedTransfer[] = [...SAMPLE_TRANSFERS, ...NOMAD_TRACE_TRANSFERS];
export const FIXTURE_BRIDGE_RESOLUTIONS: BridgeResolution[] = [
  ...SAMPLE_BRIDGE_RESOLUTIONS,
  ...NOMAD_BRIDGE_RESOLUTIONS
];

export const DEMO_TRACE_REQUEST: TraceRequest = {
  chain: "ethereum",
  seedType: "address",
  seedValue: DEMO_WALLET
};

export const DEMO_TX_TRACE_REQUEST: TraceRequest = {
  chain: "ethereum",
  seedType: "tx",
  seedValue: DEMO_TX
};

export const NOMAD_TRACE_REQUEST: TraceRequest = {
  chain: "ethereum",
  seedType: "address",
  seedValue: NOMAD_DEMO_WALLET
};

export function entityIndex(): Map<string, KnownEntity> {
  return new Map(
    KNOWN_ENTITIES.map((entity) => [`${entity.chain}:${normalizeAddress(entity.chain, entity.address)}`, entity])
  );
}

export function transferIndex(): Map<string, NormalizedTransfer> {
  return new Map(FIXTURE_TRANSFERS.map((transfer) => [makeEdgeId(transfer), transfer]));
}
