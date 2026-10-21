# Sergio Rodriguez
### Security research · reverse engineering · adversarial testing

I trace inputs across trust boundaries, build the smallest failing case, and turn the result into a regression you can run.

I’m an Iona University undergraduate pursuing security research and red-team internships. My public work connects C and Python, Ghidra analysis, protocol behavior, and stateful authorization. The source and evidence are the starting point.

[Portfolio](https://sergrdz.pages.dev/) · [Research workbench](https://sergrdz.pages.dev/workbench.html) · [Email](mailto:sergio.w.rdz@gmail.com) · [LinkedIn](https://www.linkedin.com/in/sergio-rodriguez-453551275)

## Three investigations to start with

| Investigation | Failure under test | Evidence |
|---|---|---|
| **[Cutline](https://github.com/SSH-PuR66/cutline)** | Unsigned addition wraps a range check; decompiler-inferred types differ across optimization levels. | Original C fixtures, O0/O2 builds, Ghidra exports, native reference tests. Each recorded build covers 256 byte values and 21,728 range triples. [Inspect the instrument](https://sergrdz.pages.dev/labs/binary-boundary/). |
| **[Countersign](https://github.com/SSH-PuR66/countersign)** | A valid tool name survives a changed target, argument, caller, or replay. | Python/HMAC/SQLite reference gate; 56 recorded tests and 29 controlled vectors, including concurrent and cross-process replay. [Inspect the decisions](https://sergrdz.pages.dev/labs/call-boundary/). |
| **[Afterimage](https://github.com/SSH-PuR66/afterimage)** | Sensitive headers cross a redirect boundary; chunk framing changes across a published fix. | Pinned upstream wheels, before/after results, benign controls, and original reporter attribution. 12 redirect cases and 32 chunk-framing cases. [Inspect the study](https://sergrdz.pages.dev/labs/cve-replay/). |

**Read the evidence:** Cutline and Countersign are original controlled experiments. Afterimage independently reproduces published urllib3 issues. Each repository records the exact tested behavior, revision, and execution boundary.

## How I investigate

1. Define what the input controls and which decision it reaches.
2. Trace the value through source, bytes, state, and output.
3. Reduce the failure to a deterministic counterexample.
4. Compare the failure against a benign control and a corrected implementation.
5. Publish the reproducer, result, and remaining uncertainty together.

The hard part is separating a convincing explanation from a result that survives another run.

## More source

[RangeCheck / Tools](https://github.com/SSH-PuR66/Tools) · [DetectLab](https://github.com/SSH-PuR66/detect-lab) · [PolicyScout](https://github.com/SSH-PuR66/policy-scout) · [Filament](https://github.com/SSH-PuR66/filament)

**Internship focus:** vulnerability research, reverse engineering, application security, and adversarial evaluation.

Hudson Valley / NYC metro · [sergio.w.rdz@gmail.com](mailto:sergio.w.rdz@gmail.com)

