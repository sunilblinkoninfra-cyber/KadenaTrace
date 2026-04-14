import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { caseCreateSchema, walletAttestationSchema } from "@kadenatrace/shared";

import type { CaseService } from "../services/case-service.js";

const walletSignerSchema = z.object({
  accountName: z.string().min(3),
  publicKey: z.string().min(16),
  adapterName: z.string().min(1).optional()
});

const signedCommandSchema = z.object({
  cmd: z.string().min(3),
  hash: z.string().min(10),
  sigs: z.array(z.any())
});

const anchorPrepareSchema = z.object({
  signer: walletSignerSchema
});

const anchorSubmitSchema = z.object({
  signer: walletSignerSchema,
  signedCommand: signedCommandSchema
});

const attestationDraftSchema = z.object({
  wallet: z.string().min(3),
  chain: z.enum(["ethereum", "bsc", "kadena", "bitcoin"]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  riskScore: z.number().min(0).max(100),
  note: z.string().max(500).optional()
});

const attestationPrepareSchema = z.object({
  signer: walletSignerSchema,
  attestation: attestationDraftSchema
});

const attestationSubmitSchema = z.object({
  signer: walletSignerSchema,
  attestation: attestationDraftSchema,
  signedCommand: signedCommandSchema
});

export async function registerCaseRoutes(app: FastifyInstance, caseService: CaseService) {
  app.get("/api/cases/by-chain/:chain", async (request, reply) => {
    const params = request.params as { chain: string };
    const result = await caseService.listCasesByChain(params.chain);
    return reply.send(result);
  });

  app.post("/api/cases", async (request, reply) => {
    const parsed = caseCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const record = await caseService.createCase(parsed.data);
      return reply.send({
        caseId: record.caseId,
        slug: record.slug,
        publicUri: record.publicUri,
        traceHash: record.traceHash,
        verifiable: true
      });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Unable to create case." });
    }
  });

  app.post("/api/cases/:caseId/anchor/payload", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = anchorPrepareSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const payload = await caseService.prepareCaseAnchor(params.caseId, parsed.data.signer);
      return reply.send(payload);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : "Unable to prepare anchor." });
    }
  });

  app.post("/api/cases/:caseId/anchor", async (request, reply) => {
    const params = request.params as { caseId: string };
    try {
      const record = await caseService.anchorCase(params.caseId);
      return reply.send(record.anchor);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : "Unable to anchor case." });
    }
  });

  app.post("/api/cases/:caseId/anchor/submit", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = anchorSubmitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const record = await caseService.submitCaseAnchor(params.caseId, parsed.data.signer, parsed.data.signedCommand);
      return reply.send(record.anchor);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Unable to submit anchor." });
    }
  });

  app.post("/api/cases/:caseId/attestations", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = walletAttestationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const record = await caseService.addAttestation(params.caseId, parsed.data);
      return reply.send({ caseId: record.caseId, attestations: record.attestations });
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : "Unable to add attestation." });
    }
  });

  app.post("/api/cases/:caseId/attestations/payload", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = attestationPrepareSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const payload = await caseService.prepareWalletAttestation(
        params.caseId,
        parsed.data.attestation,
        parsed.data.signer
      );
      return reply.send(payload);
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : "Unable to prepare attestation." });
    }
  });

  app.post("/api/cases/:caseId/attestations/submit", async (request, reply) => {
    const params = request.params as { caseId: string };
    const parsed = attestationSubmitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const record = await caseService.submitWalletAttestation(
        params.caseId,
        parsed.data.attestation,
        parsed.data.signer,
        parsed.data.signedCommand
      );
      return reply.send({ caseId: record.caseId, attestations: record.attestations });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Unable to submit attestation." });
    }
  });

  app.get("/api/public/cases", async () => caseService.listPublicCases());

  app.get("/api/cases/:caseId/attestations", async (request, reply) => {
    const params = request.params as { caseId: string };
    const result = await caseService.listAttestationsForCase(params.caseId);
    return reply.send(result);
  });

  app.get("/api/public/cases/:slug", async (request, reply) => {
    const params = request.params as { slug: string };
    const record = await caseService.getPublicCase(params.slug);
    if (!record) {
      return reply.code(404).send({ error: "Case not found." });
    }

    return reply.send(record);
  });
}
