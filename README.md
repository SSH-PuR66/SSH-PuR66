### Sergio Rodriguez — security research and engineering

I study program behavior, reproduce published fixes, and build small tools with inspectable tests.

**Current research**

**[Afterimage](https://github.com/SSH-PuR66/afterimage)** · [Study and results](https://sergrdz.pages.dev/labs/cve-replay/)

Independent offline reproduction of the published **CVE-2026-44431** redirect-header issue, originally reported by **christos-cantina-security**. The harness compares urllib3 2.6.3 and 2.7.0. On 27 September 2026, all 12 expected outcomes matched: six cases per release, including the affected behavior and benign controls. [Inspect the passing regression workflow](https://github.com/SSH-PuR66/afterimage/actions/runs/36296853726).

The companion **[Chunk Lines](https://github.com/SSH-PuR66/afterimage/tree/main/chunk-lines)** study compares pinned urllib3 2.7.0 and 2.8.0 for published CVE-2026-97689. Its 32 bounded offline cases check framing-line handling; they do not establish memory exhaustion or application impact.

**[Countersign](https://github.com/SSH-PuR66/countersign)** · [Experiment and test record](https://sergrdz.pages.dev/labs/call-boundary/)

A local authorization gate that binds a signed approval to one actor, audience, tool, target, complete arguments, time window, and nonce. The 27 September 2026 run passed **56 tests and 29 controlled vectors**, including replay across processes and restarts. Python, HMAC-SHA256, and SQLite. [Inspect the passing regression workflow](https://github.com/SSH-PuR66/countersign/actions/runs/36296849195).

**[Cutline](https://github.com/SSH-PuR66/cutline)** · [Native and decompiler study](https://sergrdz.pages.dev/labs/binary-boundary/)

An original C fixture comparing Boolean decoding and unsigned range checks across O0 and O2 builds. Native execution and Ghidra exports expose where recovered types differ from the source contract. A [fresh 27 September 2026 rerun](https://sergrdz.pages.dev/labs/binary-boundary/verification-2026-09-27.json) matched the recorded native results and decompiler output. It covers every byte value and 21,728 range inputs per build; the full 32-bit input space is not exhausted.

**Proposed work — [Filament PR #1](https://github.com/SSH-PuR66/filament/pull/1)**

Signing checks tied to the selected app, identity, and connected device. The **open pull request** invalidates approval when an input changes and discards stale responses. [Portable CI passed on 12 September](https://github.com/SSH-PuR66/filament/actions/runs/34722602375).

**Earlier projects** — [Tools](https://github.com/SSH-PuR66/Tools) · [DetectLab](https://github.com/SSH-PuR66/detect-lab) · [PolicyScout / ArmSky](https://github.com/SSH-PuR66/policy-scout)

**Workflow prototype** — [Chairside](https://github.com/SSH-PuR66/chairside) · [Pages edition](https://github.com/SSH-PuR66/chairside-pages). A static dental workflow interface with a scenario calculator and downloadable JSON examples; clinical integrations are not connected.

**Credentials** — Cisco Certified in Cybersecurity · (ISC)² Candidate · Blue Team Junior Analyst · 18 Anthropic AI certificates

**Working with** — Python · FastAPI · scikit-learn · Docker · Cloudflare · Neo4j · Elasticsearch · the MITRE ATT&CK framework

**How I work** — controlled reproductions, inspectable test records, and explicit limits on what the evidence establishes.

Hudson Valley / NYC metro · federal cyber operations · sergio.w.rdz@gmail.com · [sergrdz.pages.dev](https://sergrdz.pages.dev)
