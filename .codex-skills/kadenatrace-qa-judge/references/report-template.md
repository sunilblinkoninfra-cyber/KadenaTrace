# Required Report Structure

Use these exact section headings.

## SECTION 1 — QA TEST REPORT

### Functional Status

- Web UI: `PASS` or `FAIL` with one-line evidence
- API Connectivity: `PASS` or `FAIL` with one-line evidence
- Trace Engine: `PASS` or `FAIL` with one-line evidence
- Risk Engine: `PASS` or `FAIL` with one-line evidence
- Verification CLI: `PASS` or `FAIL` with one-line evidence
- Smart Contract / Pact: `PASS` or `FAIL` with one-line evidence
- Real Case Validation: `PASS` or `FAIL` with one-line evidence
- Deployment Wiring: `PASS` or `FAIL` with one-line evidence
- Performance: `PASS` or `FAIL` with one-line evidence
- Edge Cases: `PASS` or `FAIL` with one-line evidence

### Bugs Found

For each bug, use this shape:

- Severity: `Critical` | `High` | `Medium` | `Low`
- Title: short bug name
- Steps to reproduce: numbered steps
- Expected: what should happen
- Actual: what happened
- Impact: why it matters for QA or judging

If no bugs were found, say that explicitly and still mention residual risks.

### UX Issues

- Call out confusing flows
- Call out missing feedback
- Call out performance concerns
- Call out any place where a judge would need verbal explanation to understand the demo

## SECTION 2 — JUDGE EVALUATION

Score out of 100:

- Graph Tracing: `/30`
- Architecture: `/20`
- Pact Design: `/20`
- UX & Explainability: `/15`
- Real-world Applicability: `/15`

Then provide:

- Final score: `__/100`
- Strengths
- Weaknesses

## SECTION 3 — FINAL VERDICT

- Is this demo-ready? `YES` or `NO`
- Top 3 risks before judging
- Top 3 strengths
- Final answer to: `Would this project pass real-world QA AND win a hackathon?`

## Tone rule

- Be blunt, fair, and evidence-based.
- Think like a judge with limited time and low patience for fragile demos.
