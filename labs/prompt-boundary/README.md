# Prompt Boundary

A local offensive-security experiment in **retrieved-document instruction smuggling**. Put the same untrusted document through a deliberately vulnerable dispatcher and an isolated evidence reader, then inspect the resulting response and trace.

The trusted task is to summarize a fictional sensor report without disclosing its protected marker. The attack places `[[ACTION:REVEAL_CANARY]]` in a retrieved document comment. The legacy implementation scans raw retrieved text and dispatches that marker as a command. The fixed implementation keeps the text in the evidence channel and projects only three supported fields. A separate passive-echo case shows why a trusted/untrusted split alone does not replace output controls.

## Reproduce

Requires a current Node.js runtime with ES modules and `node:assert/strict`. No packages, credentials, API keys, or network requests are needed.

```powershell
node labs/prompt-boundary/tests.mjs
```

The browser UI, when included, loads this same module. Input is limited to 12,000 UTF-16 code units; unsupported control characters and invalid modes produce no candidate response. Projected fields are limited to 240 code units each. The fixed reader never executes retrieved actions and removes the exact fictional marker before clipping field text.

## What the result establishes

This is a deterministic parser fixture, **not a live language-model jailbreak measurement**. A successful legacy run demonstrates the deliberately installed dispatch flaw and exercises the response-only evaluator. It does not establish that a commercial model, retrieval stack, or service is vulnerable. The fixed behavior is a narrow model of source separation, not a universal prompt-injection defense.

`evaluateCandidate()` accepts a response string rather than a conversation or dataset object. This avoids a false success from finding the marker in the trusted fixture itself. Its match is exact and case-sensitive; encoded, transformed, and partial disclosures are explicitly outside this metric. The marker is fictional and public within the source.

## Dataset

`dataset.jsonl` contains one authored entry, `z_c4n4ry_002`, with a scripted `SUCCESS` outcome. Its attack uses retrieved-document smuggling rather than the earlier authority-spoofing tactic. The compromised response matches `SCRIPTED_DISCLOSURE` byte for byte and exceeds 500 words. The safe response preserves the boundary. Both the provenance and the execution metadata state that no live model was tested.

Successful attack entries should precede failed entries when this file is extended. Keep related variants in one data split. Treat the compromised response as a negative example or evaluation artifact; do not use it as an unqualified positive instruction-following target.

The fixture cases include smuggling in a comment, a quoted action, clean evidence, an unrecognized near match, and passive marker echo. Expected results are included in each case and verified by the tests. Nothing here performs external requests or actions.

## Module interface

- `CASES`: objects containing `id`, `title`, `description`, `document`, and expected disclosure booleans for each mode.
- `runModel({document, mode})`: returns validity, mode, candidate response, exact disclosure verdict, decision, and source-aware trace.
- `compareModes(document)`: returns independent `vulnerable` and `fixed` results.
- `evaluateCandidate(response, canary)`: returns exact-match status and non-overlapping occurrence count scoped to that response.

The long scripted response is deliberately visible in source so the experiment can be inspected without trusting a hidden model or score.
