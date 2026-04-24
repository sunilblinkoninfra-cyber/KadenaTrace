# KadenaTrace Repo Checkpoints

Read this file before testing so you can target the real KadenaTrace implementation instead of guessing.

## UI anchors

- Homepage: `apps/web/app/page.tsx`
- Search form with demo buttons and default seeds: `apps/web/components/search-form.tsx`
- Trace detail page with findings, confidence, verification badge, and trace hash: `apps/web/app/trace/[traceId]/page.tsx`
- Graph panel and exports: `apps/web/components/trace-graph-panel.tsx`

## Demo inputs

- Demo wallet: `0x1111111111111111111111111111111111111111`
- Demo tx: `0x1000000000000000000000000000000000000000000000000000000000000001`
- Alternate public demo from README: `0x9000000000000000000000000000000000000000`

## API and deployment anchors

- Frontend API base resolution: `apps/web/lib/api.ts`
- Frontend falls back to `http://localhost:4000` when `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_URL` are absent.
- API app and CORS rules: `apps/api/src/app.ts`
- Health endpoints:
  - `GET /health`
  - `GET /api/health`
  - `GET /api/health/detailed`
- Trace routes: `apps/api/src/routes/traces.ts`
- Trace creation: `POST /api/traces`
- Trace fetch: `GET /api/traces/:traceId`

## Expected trace response clues

- `POST /api/traces` returns `traceId` and `status`.
- `GET /api/traces/:traceId` can return:
  - `trace`: graph, findings, suspicious paths, metrics, sources, warnings, `generatedAt`
  - `riskAnalysis`
  - `traceHash`
  - `verifiable`
- The UI trace page treats presence of `trace.result.traceHash` as the verification signal.

## Verification CLI

- Script: `scripts/verify-trace.ts`
- Package script: `npm run verify-trace`
- Correct npm invocation for an argument: `npm run verify-trace -- <trace-hash>`
- The script prints `✔ Verified` on success and `✘ Mismatch` on failure.
- The script can verify against database traces or bundled examples including:
  - `examples/sample-case.json`
  - `examples/real-chain-case.json`
  - `examples/real-scam-case.json`

## Pact anchors

- Contracts:
  - `packages/pact/contracts/ns-setup.pact`
  - `packages/pact/contracts/fraud-registry.pact`
  - `packages/pact/contracts/trace-registry.pact`
- REPL tests: `packages/pact/tests/fraud-registry.repl`
- Pact package entrypoints: `packages/pact/src/`
- README notes the dispute flow as a two-step defpact and lists the public read functions.

## Real-case fixtures

- Judge-friendly chain example: `examples/real-chain-case.json`
- Additional realistic scam example: `examples/real-scam-case.json`
- `examples/real-chain-case.json` already contains:
  - multi-hop flow
  - bridge hop with `bridgeTransferId`
  - risk signals `rapid-hops`, `fan-out`, `bridge-usage`
  - deterministic `traceHash`

## Worker and async mode

- Worker health endpoint is implemented in `apps/worker/src/worker.ts` at `GET /health`.
- API `/api/health` reports queue mode as `bullmq` or `inline`.
- Treat worker absence, stalled async traces, or inconsistent inline versus BullMQ behavior as judge-visible risks.

## High-value deployment checks

- Confirm the deployed frontend is calling a live API URL and not the localhost fallback.
- Confirm there is no broken CORS behavior between the deployed web app and API.
- Treat `http://localhost` fallbacks in runtime config as a serious demo-readiness issue unless the deployment variables are verified.
- Note that `apps/api/openapi.yml` still contains localhost examples; do not confuse documentation examples with live runtime wiring.
