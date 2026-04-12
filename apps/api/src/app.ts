import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { DEMO_TRACE_REQUEST, NOMAD_TRACE_REQUEST } from "@kadenatrace/shared";

import type { ApiConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { InMemoryCaseRepository } from "./repositories/memory-case-repository.js";
import { InMemoryTraceRepository } from "./repositories/memory-trace-repository.js";
import { PostgresCaseRepository, PostgresTraceRepository, createPostgresPool } from "./repositories/postgres.js";
import { registerCaseRoutes } from "./routes/cases.js";
import { registerTraceRoutes } from "./routes/traces.js";
import { CaseService } from "./services/case-service.js";
import { PactAnchorService } from "./services/pact-anchor-service.js";
import { BullMqTraceQueue } from "./services/trace-queue.js";
import { TraceService } from "./services/trace-service.js";

export async function buildApp(config: ApiConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    genReqId: () => randomUUID()
  });
  await app.register(cors, {
    origin: config.corsOrigin ?? "http://localhost:3000",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });
  await app.register(import("@fastify/rate-limit"), {
    max: 60,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry after ${context.after}.`
    })
  });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  const pool = config.databaseUrl ? await createPostgresPool(config.databaseUrl) : null;
  const traceRepository = pool ? new PostgresTraceRepository(pool) : new InMemoryTraceRepository();
  const caseRepository = pool ? new PostgresCaseRepository(pool) : new InMemoryCaseRepository();
  const queue = config.redisUrl ? new BullMqTraceQueue(config.redisUrl) : undefined;

  const traceService = new TraceService(
    traceRepository,
    config.covalentApiKey,
    config.ethereumRpcUrl,
    config.bscRpcUrl,
    config.bitcoinMempoolUrl,
    queue
  );
  const pactAnchorService = new PactAnchorService(config);
  const caseService = new CaseService(caseRepository, traceService, pactAnchorService, config.webBaseUrl);

  app.get("/", async () => ({
    name: "KadenaTrace API",
    status: "ok"
  }));

  app.get("/api/health", async () => ({
    status: "ok",
    queueMode: queue ? "bullmq" : "inline",
    storageMode: pool ? "postgres" : "memory"
  }));

  await registerTraceRoutes(app, traceService);
  await registerCaseRoutes(app, caseService);
  await seedDemoCases(caseService, traceService);

  app.addHook("onClose", async () => {
    if (queue) {
      await queue.close();
    }

    if (pool) {
      await pool.end();
    }
  });

  return app;
}

async function seedDemoCases(caseService: CaseService, traceService: TraceService): Promise<void> {
  await seedCaseIfMissing(
    caseService,
    traceService,
    "shadow-router-laundering-pattern",
    DEMO_TRACE_REQUEST,
    "Shadow Router Laundering Pattern",
    "A demo fraud case showing fan-out, bridge usage, mixer touchpoints, and exchange sink consolidation.",
    "This seeded case begins with a compromised wallet on Ethereum and follows the stolen funds through rapid hops, a Stargate bridge transfer into BSC, a mixer touchpoint, and eventual sink consolidation into exchange deposit wallets."
  );

  await seedCaseIfMissing(
    caseService,
    traceService,
    "nomad-bridge-exploit-demo",
    NOMAD_TRACE_REQUEST,
    "Nomad Bridge Exploit Demo",
    "A public-knowledge laundering pattern inspired by the August 2022 Nomad bridge exploit, showing copycat fan-out, rapid hops, mixer touchpoints, and a bridge-led exchange sink.",
    "This seeded case models the publicly documented Nomad bridge exploit pattern: one seed exploiter fans stolen funds out to five copycat wallets within minutes, each chain of wallets performs rapid follow-on hops, one path cashes out through a mixer, another bridges into BSC, and the destination-side beneficiary consolidates the bridged value into an exchange sink."
  );
}

async function seedCaseIfMissing(
  caseService: CaseService,
  traceService: TraceService,
  slug: string,
  request: typeof DEMO_TRACE_REQUEST,
  title: string,
  summary: string,
  narrative: string
): Promise<void> {
  const existing = await caseService.findBySlug(slug);
  if (existing) {
    return;
  }

  const trace = await traceService.createTrace(request, { preferInline: true });
  if (trace.status !== "completed") {
    return;
  }

  await caseService.createCase(
    {
      traceId: trace.id,
      title,
      summary,
      narrative
    },
    slug
  );
}
