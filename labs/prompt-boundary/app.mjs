import { CASES, MAX_DOCUMENT_CHARS, compareModes } from './model.mjs';

const input = document.querySelector('#document');
const status = document.querySelector('#input-status');
const download = document.querySelector('#download');
const presets = document.querySelector('#presets');
const count = document.querySelector('#input-count');
let selectedCase = CASES[0];
let latestComparison = null;
let latestDocument = '';

function updateCount() {
  count.textContent = `${input.value.length.toLocaleString('en-US')} / ${MAX_DOCUMENT_CHARS.toLocaleString('en-US')}`;
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
  input.setAttribute('aria-invalid', String(error));
}

function markSelection(id) {
  for (const button of presets.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.case === id));
  }
}

function renderResult(result, mode) {
  const verdict = document.querySelector(`#${mode}-verdict`);
  verdict.textContent = !result.ok ? 'Input rejected' : result.leaked ? 'Canary exposed' : 'Canary withheld';
  verdict.dataset.state = !result.ok ? 'invalid' : result.leaked ? 'leaked' : 'held';
  document.querySelector(`#${mode}-response`).textContent = result.response || result.error || 'No response emitted.';
  const trace = document.querySelector(`#${mode}-trace`);
  trace.replaceChildren();
  for (const step of result.trace) {
    const item = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = `${step.stage} / ${step.outcome}`;
    const detail = document.createElement('div');
    detail.textContent = `${step.source}: ${step.detail}`;
    item.append(label, detail);
    trace.append(item);
  }
}

function runComparison() {
  const comparison = compareModes(input.value);
  renderResult(comparison.vulnerable, 'vulnerable');
  renderResult(comparison.fixed, 'fixed');
  latestComparison = comparison;
  latestDocument = input.value;
  download.disabled = false;
  const invalid = !comparison.vulnerable.ok || !comparison.fixed.ok;
  const outcome = invalid
    ? 'Input rejected by the fixture. Inspect the decision traces for the bound that failed.'
    : `Comparison complete. Vulnerable: ${comparison.vulnerable.leaked ? 'canary exposed' : 'canary withheld'}. Fixed: ${comparison.fixed.leaked ? 'canary exposed' : 'canary withheld'}.`;
  setStatus(outcome, invalid);
  updateCount();
}

function selectCase(testCase) {
  selectedCase = testCase;
  input.value = testCase.document;
  markSelection(testCase.id);
  runComparison();
}

for (const testCase of CASES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.case = testCase.id;
  button.textContent = testCase.title;
  button.title = testCase.description;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => selectCase(testCase));
  presets.append(button);
}

input.addEventListener('input', () => {
  updateCount();
  markSelection('');
  download.disabled = true;
  setStatus('Document changed. Run both readers to update the displayed responses.');
});

document.querySelector('#run').addEventListener('click', runComparison);
document.querySelector('#reset').addEventListener('click', () => selectCase(selectedCase));

download.addEventListener('click', () => {
  if (!latestComparison || download.disabled) return;
  const artifact = {
    schema: 'prompt-boundary-comparison/v1',
    provenance: 'deterministic_local_fixture_no_live_llm',
    evaluatedAt: new Date().toISOString(),
    document: latestDocument,
    evaluationScope: 'candidate_response_only',
    results: latestComparison,
    limitations: 'Exact matching only; encoded or partial disclosure is not measured. This model does not establish a jailbreak against a deployed language model.'
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'prompt-boundary-comparison.json';
  document.body.append(link);
  link.click();
  link.remove();
  // Retain the object URL briefly so the browser can finish consuming it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

if (selectedCase) selectCase(selectedCase);
else setStatus('No document presets are available. Enter a document to run the fixture.');
