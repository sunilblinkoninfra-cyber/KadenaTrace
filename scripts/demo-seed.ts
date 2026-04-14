// demo-seed.ts -- Seeds a reproducible demo investigation, persists it, and prints the verifiable case summary.
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { DEMO_TRACE_REQUEST } from "@kadenatrace/shared";

import { loadConfig } from "../apps/api/src/config.js";
import { InMemoryCaseRepository } from "../apps/api/src/repositories/memory-case-repository.js";
import { InMemoryTraceRepository } from "../apps/api/src/repositories/memory-trace-repository.js";
import { PostgresCaseRepository, PostgresTraceRepository, createPostgresPool } from "../apps/api/src/repositories/postgres.js";
import { CaseService } from "../apps/api/src/services/case-service.js";
import { PactAnchorService } from "../apps/api/src/services/pact-anchor-service.js";
import { TraceService } from "../apps/api/src/services/trace-service.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = config.databaseUrl ? await createPostgresPool(config.databaseUrl) : null;
  const traceRepository = pool ? new PostgresTraceRepository(pool) : new InMemoryTraceRepository();
  const caseRepository = pool ? new PostgresCaseRepository(pool) : new InMemoryCaseRepository();
  const traceService = new TraceService(
    traceRepository,
    config.covalentApiKey,
    config.ethereumRpcUrl,
    config.bscRpcUrl,
    config.bitcoinMempoolUrl
  );
  const caseService = new CaseService(caseRepository, traceService, new PactAnchorService(config), config.webBaseUrl);

  try {
    const trace = await traceService.createTrace(DEMO_TRACE_REQUEST, { preferInline: true });
    if (trace.status !== "completed" || !trace.result) {
      throw new Error(`Trace did not complete successfully. Current status: ${trace.status}`);
    }

    const fraudCase = await caseService.createCase(
      {
        traceId: trace.id,
        title: "Shadow Router Forensic Demo",
        summary: "Deterministic sample case for verifying trace hashing, risk reasoning, and Kadena anchoring.",
        narrative:
          "This seeded case follows the demo compromise wallet through a fan-out burst, bridge hop, and exchange cash-out. The stored trace hash can be recomputed independently from the canonicalized edge list."
      },
      "shadow-router-forensic-demo"
    );

    const sampleOutput = {
      inputWallet: DEMO_TRACE_REQUEST.seedValue,
      traceId: trace.id,
      caseId: fraudCase.caseId,
      traceHash: trace.result.traceHash,
      verifiable: trace.result.verifiable,
      riskAnalysis: trace.result.riskAnalysis,
      graph: trace.result.graph
    };

    await mkdir(join(process.cwd(), "examples"), { recursive: true });
    await writeFile(join(process.cwd(), "examples", "sample-case.json"), JSON.stringify(sampleOutput, null, 2));

    console.log(JSON.stringify(sampleOutput, null, 2));
  } finally {
    await pool?.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unable to seed the demo case.");
  process.exitCode = 1;
});
