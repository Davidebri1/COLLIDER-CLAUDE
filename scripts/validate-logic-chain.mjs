#!/usr/bin/env node
// Logic-chain validation for the Smart Gen model (MiniMax M3 via NVIDIA NIM).
//
// Method (deliberately NOT response-grading): send one fixed probe message,
// capture the reply, then ask "why?" five times in a row — each why targets
// the previous answer. Record every chain verbatim. The only thing measured
// is CONVERGENCE: across N independent replications, does the final "why"
// bottom out at the same root every time? A model whose causal chain is
// intact lands on the same root regardless of surface phrasing; a model
// that's pattern-matching drifts. Responses are recorded, never judged.
//
// Usage:
//   node scripts/validate-logic-chain.mjs [replications=100] [concurrency=8]
// Env:
//   NVIDIA_API_KEY / EXPO_PUBLIC_NVIDIA_API_KEY — falls back to the shipped key.
// Output:
//   scripts/out/logic-chain-<timestamp>.jsonl  (one replication per line, raw)
//   scripts/out/logic-chain-<timestamp>.summary.json

import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "minimaxai/minimax-m3";
const KEY =
  process.env.NVIDIA_API_KEY ||
  process.env.EXPO_PUBLIC_NVIDIA_API_KEY ||
  "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";

const REPLICATIONS = parseInt(process.argv[2] || "100", 10);
const CONCURRENCY = parseInt(process.argv[3] || "8", 10);
const WHYS = 5;

// Same operating posture the model has inside the app: it evaluates a single
// user message for smart-gen value, acts, and never dangles offers.
const SYSTEM = [
  "You are Smart Gen, the background intelligence of a mobile assistant app.",
  "You evaluate each user message and act on it directly: capture deadlines as reminders, surface the concrete next step, produce the useful thing now instead of offering to produce it.",
  "Never ask permission for something you can simply deliver. Never dangle offers.",
  "Answer concisely — a short paragraph at most.",
].join(" ");

// One fixed probe. Every replication sees exactly this, cold.
const PROBE =
  "My landlord still hasn't returned my security deposit and it's been 45 days. " +
  "I think the small-claims filing deadline in my state is August 15.";

const WHY_PROMPT =
  "Why? Answer with the single underlying reason for your previous answer, in one or two sentences.";

// Global pacer: the free NVIDIA key rate-limits hard when requests start in
// bursts (observed live: 8 simultaneous chains → solid 429s; paced singles →
// clean 200s). Every request start, including retries, waits its turn.
const PACE_MS = parseInt(process.env.PACE_MS || "4000", 10);
let nextSlot = 0;
async function pace() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + PACE_MS;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

async function callModel(messages, attempt = 0) {
  await pace();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: 4096 }),
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 8) throw new Error(`HTTP ${res.status} after ${attempt} retries`);
    await new Promise((r) => setTimeout(r, Math.min(60000, 3000 * 2 ** attempt) + Math.random() * 2000));
    return callModel(messages, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content || "").trim();
}

async function runReplication(i) {
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: PROBE },
  ];
  const chain = [];
  const t0 = Date.now();
  const initial = await callModel(messages);
  messages.push({ role: "assistant", content: initial });
  for (let w = 0; w < WHYS; w++) {
    messages.push({ role: "user", content: WHY_PROMPT });
    const answer = await callModel(messages);
    messages.push({ role: "assistant", content: answer });
    chain.push(answer);
  }
  return { replication: i, ms: Date.now() - t0, initial, whys: chain, finalWhy: chain[chain.length - 1] };
}

// ── Convergence measurement (mechanical, not evaluative) ────────────────────
const STOP = new Set("the a an of to for and or in on at with that this is are was were be been by it as from if then so but not no yes just about your you their its because they user".split(" "));
const toks = (s) => (s.toLowerCase().match(/[a-z]{3,}/g) || []).filter((t) => !STOP.has(t));
function overlap(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.sqrt(A.size * B.size);
}

function summarize(results) {
  const finals = results.map((r) => toks(r.finalWhy));
  // Pairwise mean overlap of final-why answers: 1.0 = literally the same
  // root every time, ~0 = a different root every replication.
  let sum = 0, pairs = 0;
  for (let i = 0; i < finals.length; i++)
    for (let j = i + 1; j < finals.length; j++) { sum += overlap(finals[i], finals[j]); pairs++; }
  const meanPairwise = pairs ? sum / pairs : 0;
  // Term frequency across final answers — the recurring root vocabulary.
  const freq = {};
  for (const f of finals) for (const t of new Set(f)) freq[t] = (freq[t] || 0) + 1;
  const topTerms = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([term, n]) => ({ term, appearsInPct: Math.round((n / finals.length) * 100) }));
  // Per-depth convergence: does the chain tighten as it deepens?
  const perDepth = [];
  for (let d = 0; d < WHYS; d++) {
    const layer = results.map((r) => toks(r.whys[d] || ""));
    let s = 0, p = 0;
    for (let i = 0; i < layer.length; i++)
      for (let j = i + 1; j < layer.length; j++) { s += overlap(layer[i], layer[j]); p++; }
    perDepth.push({ depth: d + 1, meanPairwiseOverlap: p ? +(s / p).toFixed(3) : 0 });
  }
  return { replications: results.length, meanPairwiseFinalOverlap: +meanPairwise.toFixed(3), perDepth, topFinalTerms: topTerms };
}

async function main() {
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "out");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rawPath = join(outDir, `logic-chain-${stamp}.jsonl`);
  const sumPath = join(outDir, `logic-chain-${stamp}.summary.json`);

  console.log(`model=${MODEL} replications=${REPLICATIONS} concurrency=${CONCURRENCY} whys=${WHYS}`);
  const results = [];
  let next = 0, done = 0, failed = 0;
  async function worker() {
    while (next < REPLICATIONS) {
      const i = next++;
      try {
        const r = await runReplication(i);
        results.push(r);
        appendFileSync(rawPath, JSON.stringify(r) + "\n");
        done++;
        console.log(`rep ${i} ok (${(r.ms / 1000).toFixed(0)}s) — ${done}/${REPLICATIONS} done, ${failed} failed`);
      } catch (e) {
        failed++;
        appendFileSync(rawPath, JSON.stringify({ replication: i, error: String(e).slice(0, 300) }) + "\n");
        console.log(`rep ${i} FAILED: ${String(e).slice(0, 120)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const summary = { model: MODEL, probe: PROBE, whyPrompt: WHY_PROMPT, system: SYSTEM, failed, ...summarize(results) };
  writeFileSync(sumPath, JSON.stringify(summary, null, 2));
  console.log("\nSUMMARY:\n" + JSON.stringify(summary, null, 2));
  console.log(`\nraw: ${rawPath}\nsummary: ${sumPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
