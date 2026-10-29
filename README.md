# Sergio Rodriguez

**Sergio Rodriguez · SSH-PuR66** — author of the original studies below and maintainer of the repositories linked here. Forks identify their upstream authors and my contribution separately.

### Offensive security · vulnerability research · adversarial evaluation

I trace attacker-controlled inputs across trust boundaries, build the smallest failing case, and turn the result into a regression you can run.

I’m an Iona University undergraduate pursuing security research and red-team internships. My public work connects C and Python, Ghidra analysis, protocol behavior, stateful authorization, and instruction-boundary experiments. The source and evidence are the starting point.

[Portfolio](https://sergrdz.pages.dev/) · [Scoped paid projects](https://sergrdz.pages.dev/work-with-me) · [Research workbench](https://sergrdz.pages.dev/workbench.html) · [Email](mailto:sergio.w.rdz@gmail.com) · [LinkedIn](https://www.linkedin.com/in/sergio-rodriguez-453551275)

[Open Prompt Boundary](https://sergrdz.pages.dev/labs/prompt-boundary/) — compare retrieved-document instruction smuggling and forged tool-result roles in a deterministic model with vulnerable and fixed paths. Entry 003 adds role-serialization controls; 33 checks exercise the local fixture.

[Enter Attack Atlas](https://sergrdz.pages.dev/labs/attack-atlas/) — Faultline, Sealbreak, and False Colors turn three trust-boundary failures into interactive visual studies.

## Four investigations to start with

| Investigation | Failure under test | Evidence |
|---|---|---|
| **[Prompt Boundary](https://github.com/SSH-PuR66/SSH-PuR66/tree/main/labs/prompt-boundary)** | Retrieved content becomes a command or a forged system-role frame. | Deterministic vulnerable/fixed model, fictional canary, JSONL fixture, and response-scoped exact-match evaluation. Outcomes are synthetic model behavior, not measured jailbreaks against a live LLM. [Inspect the lab](https://sergrdz.pages.dev/labs/prompt-boundary/). |
| **[Faultline](https://github.com/SSH-PuR66/cutline)** | Unsigned addition wraps a range check; decompiler-inferred types differ across optimization levels. | Original C fixtures, O0/O2 builds, Ghidra exports, native reference tests. Each recorded build covers 256 byte values and 21,728 range triples. [Inspect the instrument](https://sergrdz.pages.dev/labs/binary-boundary/). |
| **[Sealbreak](https://github.com/SSH-PuR66/countersign)** | A valid tool name survives a changed target, argument, caller, or replay. | Python/HMAC/SQLite reference gate, controlled adversarial vectors, and recorded tests for input ownership, concurrent and cross-process replay, and evidence integrity. [Inspect the decisions](https://sergrdz.pages.dev/labs/call-boundary/). |
| **[Afterimage](https://github.com/SSH-PuR66/afterimage)** | Sensitive headers cross a redirect boundary; chunk framing changes across a published fix. | Pinned upstream wheels, before/after results, benign controls, and original reporter attribution. 12 redirect cases and 32 chunk-framing cases. [Inspect the study](https://sergrdz.pages.dev/labs/cve-replay/). |

**Read the evidence:** Prompt Boundary is a deterministic instruction-boundary model. Faultline and Sealbreak are original controlled experiments. Afterimage independently reproduces published urllib3 issues. Each study identifies what was tested and where its results stop.

## How I investigate

1. Define what the input controls and which decision it reaches.
2. Trace the value through source, bytes, state, and output.
3. Reduce the failure to a deterministic counterexample.
4. Compare the failure against a benign control and a corrected implementation.
5. Publish the reproducer, result, and remaining uncertainty together.

The hard part is separating a convincing explanation from a result that survives another run.

## Interactive systems

[Monstros Arena](https://sergrdz.pages.dev/labs/monstros/) combines a licensed historical vehicle photograph, attributed seizure and destruction records, and a WebGL 2 garage and desert yard with three sculpted truck meshes, rounded tires, visible suspension, vertex-level dents, a damage scrubber, cinematic cameras, three lighting presets, optional synthesized sound, and bounded particle/debris/trail effects. Thirty-seven geometry, damage, and presentation checks accompany its seeded arcade engine, which produces a bounded event ledger and recomputable replay files. Fourteen engine checks cover determinism, invalid inputs, tampered events and terminal tick padding. The fictional rules are separate from [Cartel Kit’s sourced model audit](https://sergrdz.pages.dev/case-studies/cartelkit). [Inspect the engine and tests](https://github.com/SSH-PuR66/SSH-PuR66/tree/main/labs/monstros).

[Discuss a scoped project](https://sergrdz.pages.dev/work-with-me): a bounded source review, a reproducible fixture, or an interactive technical demo. Deliverables, fee, schedule and acceptance criteria are agreed before work begins.

## More source

[RangeCheck / Tools](https://github.com/SSH-PuR66/Tools) · [DetectLab](https://github.com/SSH-PuR66/detect-lab) · [PolicyScout](https://github.com/SSH-PuR66/policy-scout) · [Filament](https://github.com/SSH-PuR66/filament)

**Internship focus:** offensive security, vulnerability research, reverse engineering, application security, and adversarial evaluation.

Hudson Valley / NYC metro · [sergio.w.rdz@gmail.com](mailto:sergio.w.rdz@gmail.com)

### Adversarial research updates · 28 October 2026

[Faultline saved-record integrity](https://github.com/SSH-PuR66/cutline/commit/a7ac40200bc664e3d2c27d6a8a98828c2323b188) adds 24 adversarial checks for duplicate records, source-list replacement, invalid addresses, and inconsistent arithmetic witnesses. [Sealbreak stateful campaign](https://github.com/SSH-PuR66/countersign/blob/main/evidence/stateful-campaign-2026-10-28.json) records 832 local gate decisions: 704 rejected mutations, 64 accepted controls, and 64 rejected replays, with zero mismatches. Both final commits passed CI on Python 3.12 and 3.14. These results concern local fixtures and recorded evidence, not third-party exploitation or accepted vulnerability reports.
