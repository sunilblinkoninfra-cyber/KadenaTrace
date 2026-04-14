// verify-trace.ts -- Verifies a trace hash against stored traces from the database or bundled example cases.
type TraceEdge = {
  amount: number;
  asset: string;
  bridgeTransferId?: string | null;
  chain: string;
  from: string;
  synthetic?: boolean;
  timestamp: string;
  to: string;
  txHash: string;
};

type TraceEnvelope = {
  caseId?: string;
  edges?: TraceEdge[];
  graph?: {
    edges?: TraceEdge[];
  };
  trace?: {
    graph?: {
      edges?: TraceEdge[];
    };
  };
  traceHash?: string;
  traceSnapshot?: {
    graph?: {
      edges?: TraceEdge[];
    };
    traceHash?: string;
  };
};

type VerificationCandidate = {
  edges: TraceEdge[];
  label: string;
  source: "database" | "example";
  storedHash?: string;
};

type VerificationOutcome = {
  checkedCandidates: number;
  inputHash: string;
  label?: string;
  reason: string;
  recomputedHash?: string;
  source?: VerificationCandidate["source"];
  storedHash?: string;
  verified: boolean;
};

async function main(): Promise<void> {
  const inputHash = process.argv[2]?.trim().toLowerCase();

  if (!inputHash) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!/^[a-f0-9]{64}$/.test(inputHash)) {
    console.error("✘ Mismatch");
    console.error("Reason: trace hash must be a 64-character lowercase hex string.");
    process.exitCode = 1;
    return;
  }

  try {
    const candidates = await loadVerificationCandidates();
    if (candidates.length === 0) {
      console.error("✘ Mismatch");
      console.error("Reason: no stored traces were available in the database or bundled examples.");
      process.exitCode = 1;
      return;
    }

    const outcome = await verifyAgainstCandidates(inputHash, candidates);
    if (outcome.verified) {
      console.log("✔ Verified");
      console.log(`Source: ${outcome.source} (${outcome.label})`);
      if (outcome.storedHash) {
        console.log(`Stored hash: ${outcome.storedHash}`);
      }
      if (outcome.recomputedHash) {
        console.log(`Recomputed hash: ${outcome.recomputedHash}`);
      }
      return;
    }

    console.error("✘ Mismatch");
    console.error(`Reason: ${outcome.reason}`);
    console.error(`Checked candidates: ${outcome.checkedCandidates}`);
    if (outcome.source && outcome.label) {
      console.error(`Closest source: ${outcome.source} (${outcome.label})`);
    }
    if (outcome.storedHash) {
      console.error(`Stored hash: ${outcome.storedHash}`);
    }
    if (outcome.recomputedHash) {
      console.error(`Recomputed hash: ${outcome.recomputedHash}`);
    }
    process.exitCode = 1;
  } catch (error) {
    console.error("✘ Mismatch");
    console.error(`Reason: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

async function loadVerificationCandidates(): Promise<VerificationCandidate[]> {
  const candidates: VerificationCandidate[] = [];
  const dbCandidates = await loadDatabaseCandidates();

  if (dbCandidates.length > 0) {
    candidates.push(...dbCandidates);
  }

  const exampleCandidates = await loadExampleCandidates();
  candidates.push(...exampleCandidates);

  return dedupeCandidates(candidates);
}

async function loadDatabaseCandidates(): Promise<VerificationCandidate[]> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return [];
  }

  try {
    const pgModule = (await import("pg")) as { Pool: new (options: { connectionString: string }) => DatabasePool };
    const pool = new pgModule.Pool({ connectionString: databaseUrl });

    try {
      const traceRows = await pool.query<DatabaseTraceRow>(
        "select id, result from trace_runs where result is not null order by updated_at desc"
      );
      const caseRows = await pool.query<DatabaseCaseRow>(
        "select case_id, trace_hash, trace_snapshot from fraud_cases order by updated_at desc"
      );

      return [
        ...traceRows.rows.flatMap((row) =>
          toCandidate(
            `trace run ${row.id}`,
            "database",
            row.result?.traceHash,
            row.result?.graph?.edges
          )
        ),
        ...caseRows.rows.flatMap((row) =>
          toCandidate(
            `fraud case ${row.case_id}`,
            "database",
            row.trace_hash ?? row.trace_snapshot?.traceHash,
            row.trace_snapshot?.graph?.edges
          )
        )
      ];
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.warn(
      `[verify-trace] Database lookup skipped: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

async function loadExampleCandidates(): Promise<VerificationCandidate[]> {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");

  const examplePaths = [
    resolve(process.cwd(), "examples", "sample-case.json"),
    resolve(process.cwd(), "examples", "real-scam-case.json")
  ];

  const candidates: VerificationCandidate[] = [];

  for (const filePath of examplePaths) {
    try {
      const raw = await readFile(filePath, "utf8");
      const payload = JSON.parse(raw) as TraceEnvelope;
      const label = filePath.split(/[/\\]/).at(-1) ?? filePath;
      candidates.push(
        ...toCandidate(
          label,
          "example",
          payload.traceHash ?? payload.traceSnapshot?.traceHash,
          payload.edges ?? payload.graph?.edges ?? payload.trace?.graph?.edges ?? payload.traceSnapshot?.graph?.edges
        )
      );
    } catch (error) {
      if (isMissingFileError(error)) {
        continue;
      }
      throw error;
    }
  }

  return candidates;
}

async function verifyAgainstCandidates(
  inputHash: string,
  candidates: VerificationCandidate[]
): Promise<VerificationOutcome> {
  const { computeTraceHash } = (await import("@kadenatrace/shared")) as unknown as {
    computeTraceHash: (edges: TraceEdge[]) => { traceHash: string };
  };

  for (const candidate of candidates) {
    const recomputedHash = computeTraceHash(candidate.edges).traceHash;

    if (candidate.storedHash === inputHash && recomputedHash !== inputHash) {
      return {
        checkedCandidates: candidates.length,
        inputHash,
        label: candidate.label,
        reason: "stored hash exists, but the recomputed graph hash no longer matches the supplied commitment.",
        recomputedHash,
        source: candidate.source,
        storedHash: candidate.storedHash,
        verified: false
      };
    }

    if (recomputedHash === inputHash) {
      return {
        checkedCandidates: candidates.length,
        inputHash,
        label: candidate.label,
        reason: "hash verified successfully.",
        recomputedHash,
        source: candidate.source,
        storedHash: candidate.storedHash ?? recomputedHash,
        verified: true
      };
    }
  }

  return {
    checkedCandidates: candidates.length,
    inputHash,
    reason: "no stored trace produced the supplied deterministic hash.",
    verified: false
  };
}

function toCandidate(
  label: string,
  source: VerificationCandidate["source"],
  storedHash: string | undefined,
  edges: TraceEdge[] | undefined
): VerificationCandidate[] {
  if (!Array.isArray(edges) || edges.length === 0) {
    return [];
  }

  return [
    {
      edges,
      label,
      source,
      storedHash
    }
  ];
}

function dedupeCandidates(candidates: VerificationCandidate[]): VerificationCandidate[] {
  const seen = new Set<string>();
  const deduped: VerificationCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.label}:${candidate.storedHash ?? "no-hash"}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function printUsage(): void {
  console.error("Usage: npm run verify-trace -- <trace-hash>");
}

type DatabaseTraceRow = {
  id: string;
  result: {
    graph?: {
      edges?: TraceEdge[];
    };
    traceHash?: string;
  } | null;
};

type DatabaseCaseRow = {
  case_id: string;
  trace_hash: string | null;
  trace_snapshot: {
    graph?: {
      edges?: TraceEdge[];
    };
    traceHash?: string;
  } | null;
};

type QueryResult<Row> = {
  rows: Row[];
};

type DatabasePool = {
  end(): Promise<void>;
  query<Row>(sql: string): Promise<QueryResult<Row>>;
};

void main();
