---
name: kadenatrace-qa-judge
description: Perform a complete end-to-end manual QA and hackathon-judge evaluation for KadenaTrace. Use when Codex needs to test the KadenaTrace web UI, live API connectivity, worker health, trace engine, risk engine, CLI trace verification, Pact contracts, bundled real-case fixtures, deployment wiring, performance, and edge cases, then return a strict three-section report with PASS/FAIL module status, bugs, UX issues, scoring, and final demo-readiness verdict.
---

# KadenaTrace QA Judge

## Overview

Run an evidence-first A-Z test pass of KadenaTrace from two viewpoints at the same time: senior QA engineer and blockchain hackathon judge.

Do not assume that a feature works because code exists. Prefer browser evidence, HTTP responses, CLI output, and Pact test output over code inspection. Use code inspection to explain behavior, confirm wiring, or prove deployment risks such as localhost fallbacks and CORS rules.

## Workflow

### 1. Build test context

- Read [references/repo-checkpoints.md](references/repo-checkpoints.md) first for KadenaTrace-specific commands, endpoints, demo inputs, and file anchors.
- Read [references/test-matrix.md](references/test-matrix.md) before testing so every mandatory flow is covered.
- Decide whether you are testing a deployed system, local dev servers, or both. Prefer deployed behavior when the user is asking about demo readiness.
- If a required check is blocked by missing credentials, missing services, or lack of a running deployment, say so explicitly and treat it as a readiness risk.

### 2. Execute the mandatory test matrix

- Test every flow in the matrix. Do not silently skip items.
- Use browser automation when a live URL or dev server is available.
- Use direct HTTP checks for `/api/health`, `/api/health/detailed`, `/api/traces`, and trace detail fetches.
- Capture concrete evidence for recursive graph expansion, multi-hop correctness, bridge representation, risk explanation quality, verification behavior, and deployment wiring.
- Run the CLI verification command with a real trace hash and at least one negative mismatch case.
- Run Pact REPL tests when the live signing or dispute flow cannot be exercised safely.

### 3. Judge like a time-pressed reviewer

- Score only what is demonstrated clearly.
- Penalize demo-critical weaknesses such as localhost coupling, broken verification, vague risk explanations, slow or confusing UX, or any flow that requires too much operator explanation.
- Distinguish implementation depth from demo quality. A strong codebase still loses points if the story is unclear or fragile.

### 4. Write the report

- Use the exact structure from [references/report-template.md](references/report-template.md).
- Mark a module `PASS` only when you observed the behavior directly.
- If a required module could not be exercised, mark it `FAIL` and explain the blocker unless the user explicitly asked for a partial dry run.
- Keep bugs concrete: severity, reproduction steps, expected result, actual result, and why it matters on demo day.
- End with a direct answer to: `Would this project pass real-world QA AND win a hackathon?`

## Testing standards

- Be brutally honest.
- Prefer under-crediting over giving unearned confidence.
- Treat doc mismatches, incorrect commands, hidden localhost dependencies, weak empty states, and unclear scoring explanations as real issues.
- Record rough timings for trace generation and UI responsiveness when performance is in scope.
- Separate `observed`, `code-inferred`, and `blocked` evidence in your notes. Only `observed` evidence justifies a clean PASS.

## Required references

- Use [references/repo-checkpoints.md](references/repo-checkpoints.md) for repo-specific commands, endpoints, inputs, and known deployment-sensitive areas.
- Use [references/test-matrix.md](references/test-matrix.md) for the mandatory A-Z flow list and evidence to collect.
- Use [references/report-template.md](references/report-template.md) for the exact output structure.
