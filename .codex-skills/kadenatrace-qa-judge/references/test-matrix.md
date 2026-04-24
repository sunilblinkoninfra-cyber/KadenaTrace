# KadenaTrace Mandatory Test Matrix

Execute every section below.

## 1. UI flow

- Load the homepage.
- Enter a wallet or transaction manually.
- Click `Generate Trace`.
- Use `Use demo wallet`.
- Use `Use demo tx`.
- Confirm the trace page renders a graph.
- Confirm the findings and risk explanation area are understandable.
- Confirm the verification badge and trace hash are visible when present.

Evidence to capture:

- Whether the homepage loads without broken states
- Whether the submit action shows useful progress or error feedback
- Whether the graph appears and is usable
- Whether findings show confidence and understandable explanations
- Whether verification status is obvious to a first-time judge

## 2. API connectivity

- Confirm the frontend is calling the live API and not localhost in the tested environment.
- Request `/api/health`.
- Request `/api/health/detailed` if available.
- Validate the trace create response shape.
- Validate the trace fetch response shape.

Evidence to capture:

- Actual request URL used by the frontend
- HTTP status codes
- Response JSON shape
- Any CORS or mixed-environment errors

## 3. Trace engine

- Confirm the graph expands recursively from the seed.
- Confirm multi-hop relationships are preserved correctly.
- Confirm bridge transitions are represented clearly.
- Re-run the same trace if possible and check for deterministic behavior.

Evidence to capture:

- Number of nodes and edges
- Presence of suspicious paths
- Whether bridge edges or bridge-labeled nodes are visible
- Whether repeated runs change structure or risk unexpectedly

## 4. Risk engine

- Validate fan-out detection.
- Validate rapid-hop detection.
- Validate bridge-usage detection.
- Check whether explanations are clear enough for a judge to understand fast.
- Check confidence scoring for plausibility and presentation quality.

Evidence to capture:

- Triggered findings and severities
- Confidence values
- Explanation text quality
- Whether the overall risk verdict matches the graph story

## 5. Verification

- Extract a real `traceHash`.
- Run `npm run verify-trace -- <hash>`.
- Confirm success prints `✔ Verified`.
- Run one mismatch case with a bad or altered hash.
- Confirm the negative case fails cleanly and understandably.

Evidence to capture:

- Exact command used
- Success or failure output
- Whether the README and actual CLI behavior match

## 6. Smart contract

- Validate case creation flow if the app exposes it and the environment supports it.
- Validate hash anchoring logic.
- Validate the relevant verify-subject-hash or equivalent read path if present.
- Check dispute flow if safely testable.
- If live signing is blocked, run the Pact REPL tests and inspect contract/read-function coverage instead of pretending the flow passed.

Evidence to capture:

- Whether a case can be created end to end
- Whether anchoring and readbacks are clear
- Whether dispute behavior is demonstrable or only code-deep

## 7. Real case

- Open `examples/real-chain-case.json`.
- Validate multi-hop structure.
- Validate bridge presence.
- Validate whether the story feels realistic for a demo or judging session.

Evidence to capture:

- Node and edge story
- Bridge hop details
- Whether risk signals align with the graph

## 8. Deployment

- Confirm the API is reachable.
- Confirm the web app is connected.
- Confirm the tested flow is not using localhost unintentionally.
- Confirm there are no CORS issues.

Evidence to capture:

- Live URLs
- Runtime request targets
- Any environment misconfiguration

## 9. Performance

- Measure trace generation time.
- Measure UI responsiveness while navigating and rendering the graph.

Evidence to capture:

- Rough timings in seconds
- Whether lag is noticeable for a judge
- Whether loading states communicate progress clearly

## 10. Edge cases

- Invalid wallet input
- Empty input
- Large graph behavior if accessible
- API failure simulation or forced failure path

Evidence to capture:

- Validation quality
- Error message clarity
- Recovery behavior
- Whether the app fails gracefully

## Rating rule

- Do not award a clean PASS without direct evidence.
- If a flow is blocked, explain the blocker and count it against demo readiness.
