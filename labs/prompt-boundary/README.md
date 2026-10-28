# Prompt Boundary

A local offensive-security experiment in **tool-result role spoofing** and **retrieved-document instruction smuggling**. Put the same untrusted content through a deliberately vulnerable dispatcher and an isolated evidence reader, then inspect the resulting response and trace.

The trusted task is to summarize a fictional sensor report without disclosing its protected marker. The first attack places `[[ACTION:REVEAL_CANARY]]` in a retrieved document comment. The legacy implementation scans raw retrieved text and dispatches that marker as a command.

The new attack uses a different mechanism: it closes an interpolated `<message role="tool">` wrapper, inserts a forged system-role frame containing the toy `EMIT_PRIVATE_MARKER` command, then opens another tool frame. The legacy serializer reparses that text and accepts the forged role. The fixed reader keeps role and content in separate object fields; it never reparses the content as message metadata. It projects only three supported evidence fields. A passive-echo case separately shows why role separation does not replace output controls.

The fixture has no real tool invocation or request path. The command name selects a fixed, inert response inside the local JavaScript module.

## Reproduce

Requires a current Node.js runtime with ES modules and `node:assert/strict`. No packages, credentials, API keys, or network requests are needed.

```powershell
node labs/prompt-boundary/tests.mjs
```

The browser UI loads this same module. Input is limited to 12,000 UTF-16 code units; unsupported control characters, invalid modes, and invalid invocation envelopes produce no candidate response. Legacy transcripts are limited to 64 parsed frames, checked before any dispatch. Projected fields are limited to 240 code units each. The fixed reader never executes retrieved actions and removes the exact fictional marker before clipping field text.

The newest role-spoofing case opens by default. Link directly to it with `?case=tool-role-spoofing`; an unknown case identifier falls back to the first preset. Successful fixture cases precede controls. A custom edit disables comparison export until rerun, so the downloaded input and responses belong to the same run.

## What the result establishes

This is a deterministic parser fixture, **not a live language-model jailbreak measurement**. A successful legacy run demonstrates the deliberately installed dispatch flaw and exercises the response-only evaluator. It does not establish that a commercial model, retrieval stack, or service is vulnerable. The fixed behavior is a narrow model of source separation, not a universal prompt-injection defense.

`evaluateCandidate()` accepts a response string rather than a conversation or dataset object. This avoids a false success from finding the marker in the trusted fixture itself. Its match is exact and case-sensitive; encoded, transformed, and partial disclosures are explicitly outside this metric. The marker is fictional and public within the source.

## Dataset

`dataset.jsonl` contains two authored entries, both with scripted `SUCCESS` outcomes:

| Entry | Mechanism | Exact compromised output |
| --- | --- | --- |
| `z_c4n4ry_002` | An action string hidden in retrieved-document content is dispatched. | `SCRIPTED_DISCLOSURE` |
| `z_c4n4ry_003` | Tool content is reparsed as a forged system-role frame. | `ROLE_DISCLOSURE` |

Each compromised response matches the named module export byte for byte and exceeds 500 words. Safe responses are authored reference answers. Entry 003 also stores its exact fixed-fixture output in `execution.fixed_model_response`. Provenance and execution metadata state that no live model was tested. The public canary is an instrument for this fixture, not an application secret.

`node labs/prompt-boundary/build-dataset.mjs` regenerates entry 003 from the current model while retaining other entries and placing successful records first. The generator is idempotent. Run the tests after regeneration to verify model/record parity.

Successful attack entries should precede failed entries when this file is extended. Keep related variants in one data split. Treat the compromised response as a negative example or evaluation artifact; do not use it as an unqualified positive instruction-following target.

The fixture cases include forged system-role metadata, comment smuggling, a quoted action, and passive marker echo. Controls include clean evidence, an unrecognized action, escaped role tags, an unprivileged forged role, and nested role text without a wrapper closure. Expected results are included in each case and verified by the tests. These grammar-specific controls delimit the model; they are not claims about general prompt-injection protection. Nothing here performs external requests or actions.

## Module interface

- `CASES`: objects containing `id`, `title`, `description`, `document`, and expected disclosure booleans for each mode.
- `runModel({document, mode})`: returns validity, mode, candidate response, exact disclosure verdict, decision, and source-aware trace.
- `compareModes(document)`: returns independent `vulnerable` and `fixed` results.
- `evaluateCandidate(response, canary)`: returns exact-match status and non-overlapping occurrence count scoped to that response.

The comparison download uses `prompt-boundary-comparison/v2`, includes the exact document and both candidate results, and records the preset `fixtureId` only when the document exactly matches a preset. Timestamps identify when the browser evaluated the local fixture; they do not imply an external-model request.

The long scripted response is deliberately visible in source so the experiment can be inspected without trusting a hidden model or score.
