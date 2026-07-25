#!/usr/bin/env node
// Reads recorded 5-whys chains and has a DIFFERENT model state the root each
// one lands on. Meaning is read, not measured: a token-overlap statistic
// scores phrasing, which is the wrong instrument for asking whether two
// chains bottom out at the same place. So an independent reader does what a
// person would do at a glance — say what the root is, in its own words —
// and the roots are then grouped by that reader's own judgment of identity.
//
// The evaluator is never the model under test: judging your own chains is
// the bias this whole exercise exists to avoid.
//
// Usage:
//   node scripts/evaluate-chains.mjs <chains.jsonl ...> [--evaluator <slug>]
// Env: OPENROUTER_API_KEY (falls back to the app's shipped key)
// Output: scripts/out/evaluation-<timestamp>.json

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "out");
const KEY =
  process.env.OPENROUTER_API_KEY ||
  process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ||
  "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";

const args = process.argv.slice(2);
const evalIdx = args.indexOf("--evaluator");
const EVALUATOR = evalIdx >= 0 ? args[evalIdx + 1] : "gemini-3.6-flash";
// A slug containing "/" that isn't an OpenRouter-style vendor id still needs a
// host: NVIDIA NIM is the fallback when OpenRouter has no credit. Set
// EVAL_PROVIDER=nvidia to route there (free tier, and it hosts models that
// are NOT the one under test, which is the only property that matters here).
// Supplied via env, never committed — GitHub's secret scanning rejects a
// pushed Google key. Export GOOGLE_API_KEY before running.
const GOOGLE_KEY = process.env.GOOGLE_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "";
const PROVIDER = process.env.EVAL_PROVIDER || "google";
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || process.env.EXPO_PUBLIC_NVIDIA_API_KEY || "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";
const ENDPOINT = PROVIDER === "nvidia" ? "https://integrate.api.nvidia.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
const AUTH = PROVIDER === "nvidia" ? NVIDIA_KEY : KEY;
const files = args.filter((a, i) => !a.startsWith("--") && i !== evalIdx + 1);

async function callEvaluator(messages, attempt = 0) {
  if (PROVIDER === "google") return callGoogle(EVALUATOR, messages, { temperature: 0.2, maxTokens: 1024 });
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AUTH}`, "X-Title": "Collider chain evaluation" },
    body: JSON.stringify({ model: EVALUATOR, messages, temperature: 0.2, max_tokens: 1024 }),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    return callEvaluator(messages, attempt + 1);
  }
  if (!res.ok) throw new Error(`evaluator ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.choices?.[0]?.message?.content || "").trim();
}


// Google's own API speaks a different shape than OpenAI-compatible hosts:
// system text goes in systemInstruction, turns are "contents" with parts, and
// the key is a query param (a Bearer header is rejected — verified live).
async function callGoogle(model, messages, { temperature = 0.7, maxTokens = 4096 } = {}, attempt = 0) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  );
  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    await new Promise((r) => setTimeout(r, Math.min(60000, 2000 * 2 ** attempt) + Math.random() * 1500));
    return callGoogle(model, messages, { temperature, maxTokens }, attempt + 1);
  }
  if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "").trim();
}

const ROOT_SYS = [
  "You are reading a chain of reasoning: an initial answer, then five successive 'why?' answers drilling toward its foundation.",
  "State the ROOT the chain arrives at — the final, irreducible reason it bottoms out on — in one short sentence, in your own words.",
  "Then state whether the chain HOLDS or BREAKS. It holds if each step is an actual reason for the step above it. It breaks if any step restates the previous one without explaining it, changes the subject, or stops short of a reason.",
  'Reply with strict JSON only: {"root":"...","integrity":"holds|breaks","note":"one clause, only if it breaks"}',
].join(" ");

async function rootOf(chain) {
  const body = [
    `INITIAL ANSWER:\n${chain.initial}`,
    ...chain.whys.map((w, i) => `WHY ${i + 1}:\n${w}`),
  ].join("\n\n");
  const raw = await callEvaluator([
    { role: "system", content: ROOT_SYS },
    { role: "user", content: body },
  ]);
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  try {
    return JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
  } catch {
    return { root: cleaned.slice(0, 300), integrity: "unparsed" };
  }
}

// Grouping is also read, not computed: the same evaluator decides which roots
// are the same claim wearing different words.
const GROUP_SYS = [
  "You are given a numbered list of root reasons, each extracted from an independent reasoning chain answering the SAME question.",
  "Group them by whether they are the same underlying claim, regardless of wording. Two roots belong together when accepting one commits you to the other.",
  'Reply with strict JSON only: {"groups":[{"claim":"the shared root in one sentence","members":[1,2,...]}]}',
  "Every number must appear in exactly one group. Do not merge roots that genuinely differ.",
].join(" ");

async function groupRoots(roots) {
  const list = roots.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const raw = await callEvaluator([
    { role: "system", content: GROUP_SYS },
    { role: "user", content: list },
  ]);
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  try {
    return JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
  } catch {
    return { groups: [], raw: cleaned.slice(0, 800) };
  }
}

async function main() {
  const paths = files.length
    ? files
    : readdirSync(OUT_DIR).filter((f) => f.endsWith(".jsonl")).map((f) => join(OUT_DIR, f));
  const chains = [];
  for (const f of paths) {
    for (const line of readFileSync(f, "utf8").trim().split("\n")) {
      try {
        const r = JSON.parse(line);
        if (r.finalWhy && Array.isArray(r.whys)) chains.push({ ...r, file: f.split("/").pop() });
      } catch {}
    }
  }
  console.log(`evaluator=${EVALUATOR} chains=${chains.length}`);
  if (!chains.length) { console.log("nothing to evaluate"); return; }

  const results = [];
  for (let i = 0; i < chains.length; i++) {
    try {
      const r = await rootOf(chains[i]);
      results.push({ i: i + 1, replication: chains[i].replication, file: chains[i].file, ...r });
      console.log(`${i + 1}/${chains.length} [${r.integrity}] ${String(r.root).slice(0, 110)}`);
    } catch (e) {
      results.push({ i: i + 1, error: String(e).slice(0, 160) });
      console.log(`${i + 1}/${chains.length} FAILED ${String(e).slice(0, 90)}`);
    }
  }

  const grouped = await groupRoots(results.map((r) => r.root || "(failed)"));
  const holds = results.filter((r) => r.integrity === "holds").length;
  const breaks = results.filter((r) => r.integrity === "breaks").length;
  const largest = (grouped.groups || []).reduce((m, g) => Math.max(m, g.members?.length || 0), 0);

  const summary = {
    evaluator: EVALUATOR,
    chains: chains.length,
    integrity: { holds, breaks, other: results.length - holds - breaks },
    distinctRoots: (grouped.groups || []).length,
    largestRootShare: results.length ? +(largest / results.length).toFixed(3) : 0,
    groups: grouped.groups || [],
    perChain: results,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `evaluation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log("\n" + JSON.stringify({ ...summary, perChain: undefined, groups: summary.groups.map((g) => ({ claim: g.claim, n: g.members?.length })) }, null, 2));
  console.log(`\nwritten: ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
