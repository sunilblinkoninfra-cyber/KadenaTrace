import test from "node:test";
import assert from "node:assert/strict";

import Fastify from "fastify";
import { createSignWithKeypair, type IUnsignedCommand } from "@kadena/client";

import { buildApp } from "./app.js";

test("api exposes health and demo cases", async () => {
  const app = await buildApp({
    port: 4000,
    webBaseUrl: "http://localhost:3000",
    kadenaChainwebBaseUrl: "https://api.testnet.chainweb.com/chainweb/0.0",
    kadenaChainId: "1",
    kadenaNetworkId: "testnet04",
    kadenaSenderAccount: "kadenatrace-relayer"
  });

  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);

  const demoCases = await app.inject({ method: "GET", url: "/api/public/cases" });
  assert.equal(demoCases.statusCode, 200);
  const payload = demoCases.json() as Array<{ caseId: string; slug: string }>;
  assert.equal(payload.some((item) => item.slug === "shadow-router-laundering-pattern"), true);
  assert.equal(payload.some((item) => item.slug === "nomad-bridge-exploit-demo"), true);

  const byChain = await app.inject({ method: "GET", url: "/api/cases/by-chain/ethereum" });
  assert.equal(byChain.statusCode, 200);
  const byChainPayload = byChain.json() as { source?: string; cases?: Array<{ "subject-chain"?: string }> };
  assert.equal(byChainPayload.source, "fallback");
  assert.equal((byChainPayload.cases ?? []).every((item) => item["subject-chain"] === "ethereum"), true);

  const prepared = await app.inject({
    method: "POST",
    url: `/api/cases/${payload[0]?.caseId}/anchor/payload`,
    payload: {
      signer: {
        accountName: "k:test-public-key-0001",
        publicKey: "test-public-key-0001"
      }
    }
  });
  assert.equal(prepared.statusCode, 200);
  const preparedPayload = prepared.json() as { unsignedCommand?: { cmd: string; hash: string }; txPreview?: string };
  assert.equal(typeof preparedPayload.unsignedCommand?.cmd, "string");
  assert.equal(typeof preparedPayload.unsignedCommand?.hash, "string");
  assert.equal(preparedPayload.txPreview?.includes("0x1111111111111111111111111111111111111111"), false);

  await app.close();
});

test("api can relay a wallet-signed Kadena anchor and attestation through the live submission routes", async () => {
  const chainweb = Fastify();
  chainweb.post("/chainweb/0.0/testnet04/chain/1/pact/api/v1/local", async (request) => {
    const body = request.body as { hash?: string };
    return {
      preflightResult: createSuccessResult(body.hash ?? "preflight-request-key", 3210),
      preflightWarnings: []
    };
  });
  chainweb.post("/chainweb/0.0/testnet04/chain/1/pact/api/v1/send", async (request) => {
    const body = request.body as { cmds?: Array<{ hash: string }> };
    return {
      requestKeys: (body.cmds ?? []).map((command) => command.hash)
    };
  });
  chainweb.post("/chainweb/0.0/testnet04/chain/1/pact/api/v1/listen", async (request) => {
    const body = request.body as { listen?: string };
    return createSuccessResult(body.listen ?? "listen-request-key", 4321);
  });

  await chainweb.listen({ host: "127.0.0.1", port: 0 });
  const addressInfo = chainweb.server.address();
  const chainwebPort = typeof addressInfo === "object" && addressInfo ? addressInfo.port : 0;
  const chainwebBaseUrl = `http://127.0.0.1:${chainwebPort}/chainweb/0.0`;

  const keypair = {
    publicKey: "09e82da78d531e2d16852a923e9fe0f80f3b67a9b8d92c7f05e4782222252e12",
    secretKey: "76e1cabaa58a33321982e434f355dc7a4cfbee092a4ac1c7aac26302ba80d992"
  };
  const sign = createSignWithKeypair(keypair);

  const app = await buildApp({
    port: 4000,
    webBaseUrl: "http://localhost:3000",
    kadenaChainwebBaseUrl: chainwebBaseUrl,
    kadenaChainId: "1",
    kadenaNetworkId: "testnet04",
    kadenaSenderAccount: `k:${keypair.publicKey}`
  });

  const traceResponse = await app.inject({
    method: "POST",
    url: "/api/traces",
    payload: {
      chain: "ethereum",
      seedType: "address",
      seedValue: "0x1111111111111111111111111111111111111111"
    }
  });
  assert.equal(traceResponse.statusCode, 200);
  const tracePayload = traceResponse.json() as { traceId: string };

  const partialTraceResponse = await app.inject({
    method: "GET",
    url: `/api/traces/${tracePayload.traceId}?focusNodeId=ethereum:0x1111111111111111111111111111111111111111&depth=1&limit=5&highRiskOnly=true`
  });
  assert.equal(partialTraceResponse.statusCode, 200);
  const partialTrace = partialTraceResponse.json() as {
    result?: { graph?: { nodes?: unknown[]; edges?: unknown[] }; warnings?: string[] };
    traceHash?: string;
    verifiable?: boolean;
    riskAnalysis?: { overallScore?: number };
  };
  assert.equal((partialTrace.result?.graph?.nodes?.length ?? 0) <= 5, true);
  assert.equal(partialTrace.result?.warnings?.some((warning) => warning.includes("Partial graph view generated")), true);
  assert.equal(typeof partialTrace.traceHash, "string");
  assert.equal(partialTrace.verifiable, true);
  assert.equal(typeof partialTrace.riskAnalysis?.overallScore, "number");

  const caseResponse = await app.inject({
    method: "POST",
    url: "/api/cases",
    payload: {
      traceId: tracePayload.traceId,
      title: "Live Relay Test Case",
      summary: "Uses the mocked Chainweb node to validate sign-and-submit behavior.",
      narrative: "The route should prepare a case anchor payload, accept a valid signature, and store a confirmed anchor."
    }
  });
  assert.equal(caseResponse.statusCode, 200);
  const casePayload = caseResponse.json() as { caseId: string; traceHash?: string; verifiable?: boolean };
  assert.equal(typeof casePayload.traceHash, "string");
  assert.equal(casePayload.verifiable, true);

  const signer = {
    accountName: `k:${keypair.publicKey}`,
    publicKey: keypair.publicKey
  };

  const anchorPayloadResponse = await app.inject({
    method: "POST",
    url: `/api/cases/${casePayload.caseId}/anchor/payload`,
    payload: { signer }
  });
  assert.equal(anchorPayloadResponse.statusCode, 200);
  const anchorPayload = anchorPayloadResponse.json() as { unsignedCommand: IUnsignedCommand };
  const signedAnchor = await sign(anchorPayload.unsignedCommand);

  const anchorSubmit = await app.inject({
    method: "POST",
    url: `/api/cases/${casePayload.caseId}/anchor/submit`,
    payload: {
      signer,
      signedCommand: signedAnchor
    }
  });
  assert.equal(anchorSubmit.statusCode, 200);
  const confirmedAnchor = anchorSubmit.json() as { status: string; requestKey: string; blockHeight?: number };
  assert.equal(confirmedAnchor.status, "confirmed");
  assert.equal(confirmedAnchor.requestKey, signedAnchor.hash);
  assert.equal(confirmedAnchor.blockHeight, 4321);

  const attestationPayloadResponse = await app.inject({
    method: "POST",
    url: `/api/cases/${casePayload.caseId}/attestations/payload`,
    payload: {
      signer,
      attestation: {
        wallet: "0x9999999999999999999999999999999999999999",
        chain: "bsc",
        riskLevel: "high",
        riskScore: 81,
        note: "Mocked on-chain attestation flow"
      }
    }
  });
  assert.equal(attestationPayloadResponse.statusCode, 200);
  const attestationPayload = attestationPayloadResponse.json() as { unsignedCommand: IUnsignedCommand };
  const signedAttestation = await sign(attestationPayload.unsignedCommand);

  const attestationSubmit = await app.inject({
    method: "POST",
    url: `/api/cases/${casePayload.caseId}/attestations/submit`,
    payload: {
      signer,
      attestation: {
        wallet: "0x9999999999999999999999999999999999999999",
        chain: "bsc",
        riskLevel: "high",
        riskScore: 81,
        note: "Mocked on-chain attestation flow"
      },
      signedCommand: signedAttestation
    }
  });
  assert.equal(attestationSubmit.statusCode, 200);
  const attestationResult = attestationSubmit.json() as {
    attestations: Array<{ status?: string; requestKey?: string; blockHeight?: number }>;
  };
  const latestAttestation = attestationResult.attestations.at(-1);
  assert.equal(latestAttestation?.status, "confirmed");
  assert.equal(latestAttestation?.requestKey, signedAttestation.hash);
  assert.equal(latestAttestation?.blockHeight, 4321);

  const attestationList = await app.inject({
    method: "GET",
    url: `/api/cases/${casePayload.caseId}/attestations`
  });
  assert.equal(attestationList.statusCode, 200);
  const attestationListPayload = attestationList.json() as {
    source?: string;
    attestations?: Array<{ "case-id"?: string; "risk-score"?: number }>;
  };
  assert.equal(attestationListPayload.source, "fallback");
  assert.equal(attestationListPayload.attestations?.some((item) => item["case-id"] === casePayload.caseId), true);
  assert.equal(attestationListPayload.attestations?.some((item) => item["risk-score"] === 81), true);

  await app.close();
  await chainweb.close();
});

function createSuccessResult(requestKey: string, blockHeight: number) {
  return {
    reqKey: requestKey,
    txId: 1,
    result: {
      status: "success" as const,
      data: "ok"
    },
    gas: 1,
    logs: "test-logs",
    continuation: null,
    metaData: {
      publicMeta: {
        creationTime: 0,
        ttl: 28800,
        gasLimit: 1200,
        gasPrice: 0.000001,
        sender: "k:test"
      },
      blockTime: "2026-04-01T00:00:00Z",
      prevBlockHash: "prev",
      blockHeight,
      blockHash: "hash"
    }
  };
}

test("new endpoint integrations and edge cases", async () => {
  const app = await buildApp({
    port: 4000,
    webBaseUrl: "http://localhost:3000",
    kadenaChainwebBaseUrl: "https://api.testnet.chainweb.com/chainweb/0.0",
    kadenaChainId: "1",
    kadenaNetworkId: "testnet04",
    kadenaSenderAccount: "kadenatrace-relayer"
  });

  // a) GET /api/cases/by-chain/bitcoin
  const bitcoinCases = await app.inject({ method: "GET", url: "/api/cases/by-chain/bitcoin" });
  assert.equal(bitcoinCases.statusCode, 200);
  const byChainPayload = bitcoinCases.json() as { cases?: unknown[] };
  assert.equal(byChainPayload.cases?.length, 0);

  // b) GET /api/cases/nomad-bridge-exploit-demo
  const nomadCase = await app.inject({ method: "GET", url: "/api/public/cases/nomad-bridge-exploit-demo" });
  assert.equal(nomadCase.statusCode, 200);
  const nomadPayload = nomadCase.json() as {
    caseId: string;
    title: string;
    traceHash: string;
    traceSnapshot: { graph: { nodes: unknown[] } };
  };
  assert.equal(nomadPayload.title.includes("Nomad"), true);
  assert.equal(typeof nomadPayload.traceHash, "string");
  assert.equal(nomadPayload.traceSnapshot.graph.nodes.length > 0, true);

  // c) POST /traces with rate limit
  for (let i = 0; i < 10; i++) {
    await app.inject({
      method: "POST",
      url: "/api/traces",
      payload: { chain: "ethereum", seedType: "address", seedValue: "0x1111111111111111111111111111111111111111" }
    });
  }
  const rateLimitedRequest = await app.inject({
    method: "POST",
    url: "/api/traces",
    payload: { chain: "ethereum", seedType: "address", seedValue: "0x1111111111111111111111111111111111111111" }
  });
  assert.equal(rateLimitedRequest.statusCode, 429);

  // d) GET /api/cases/:caseId/attestations returns an empty array
  const noAttestations = await app.inject({ method: "GET", url: `/api/cases/${nomadPayload.caseId}/attestations` });
  assert.equal(noAttestations.statusCode, 200);
  const attestationPayload = noAttestations.json() as { attestations?: unknown[] };
  assert.deepEqual(attestationPayload.attestations, []);

  // e) POST /api/cases invalid body
  const invalidCase = await app.inject({
    method: "POST",
    url: "/api/cases",
    payload: {
      title: "Invalid",
      summary: "Missing traceId and narrative",
    }
  });
  assert.equal(invalidCase.statusCode, 400);
  const invalidPayload = invalidCase.json() as { error?: unknown };
  assert.ok(invalidPayload.error);

  await app.close();
});
