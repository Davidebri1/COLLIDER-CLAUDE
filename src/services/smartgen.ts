// Smart Gen — deep contextual extraction with dedup, project matching,
// priority + progress + date reasoning, and auto-naming.
// Pure function: takes conversation text + existing state, returns a batch
// of proposed items. The reducer applies them, filtering by fingerprint.

import type { Memory, Project, Reminder } from "../state";

// Binary by design (see state.tsx's Priority/collapsePriority) — "low"/"med"
// kept only so old fingerprints/persisted data don't hard-crash on load.
export type Priority = "high" | "none" | "low" | "med";
export type Progress = "todo" | "inprogress" | "done";

export type SmartMemory = {
  content: string;
  tags: string[];
  projectId?: string;
  priority: Priority;
  fingerprint: string;
};
export type SmartReminder = {
  title: string;
  due?: number;
  priority: Priority;
  projectId?: string;
  progress: Progress;
  tags: string[];
  fingerprint: string;
  isTask: boolean; // true → tracks as project task; false → time-based reminder
};
export type SmartProject = { name: string; fingerprint: string };

export type SmartBatch = {
  memories: SmartMemory[];
  reminders: SmartReminder[];
  projects: SmartProject[];
};

// ── Utilities ──────────────────────────────────────────────────────────────
const HIGH_PRIORITY_TOKENS = [
  "legal","statute","statutes","court","lawsuit","filing","deadline","urgent","critical",
  "emergency","asap","overdue","must","final","attorney","subpoena","hearing","trial",
  "tax","irs","medical","hospital","surgery","exam","interview","flight","boarding",
];
const PROJECT_HINTS = [
  /\bmy\s+([a-z][\w\s-]{2,40})\s+(case|project|matter|business|startup|thesis|trip|move|renovation)\b/i,
  /\b(case|project|matter)\s+(?:called|named)\s+["']?([\w\s-]{2,40})["']?/i,
  /\bnew\s+(project|case|matter)\s*[:\-]?\s*([\w\s-]{2,40})/i,
];
// Explicit backward-references — "my previous case", "the Henderson project",
// "add this to my other matter". These are a deliberate pointer at an
// EXISTING project, so they get looked up with a much lower bar than the
// ambient auto-attach path below: the user (or assistant, on their behalf)
// named it on purpose, so a weak textual match is still the right match.
const PREVIOUS_PROJECT_HINTS = [
  /\b(?:my|the)\s+(?:old|previous|prior|other|last|earlier)\s+([a-z][\w\s-]{2,40}?)\s*(?:case|project|matter|business)?\b/i,
  /\b(?:add|send|attach|put|file)\s+(?:this|that|it)\s+(?:to|under|in)\s+(?:my\s+|the\s+)?([a-z][\w\s-]{2,40}?)\s*(?:case|project|matter)?\b/i,
  /\bback\s+(?:to|on)\s+(?:my\s+|the\s+)([a-z][\w\s-]{2,40}?)\s*(?:case|project|matter)\b/i,
];
const STOP = new Set(["the","a","an","of","to","for","and","or","in","on","at","with","that","this","is","are","was","were","be","been","by","it","as","from","if","then","so","but","not","no","yes","just","now"]);

export function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}
export function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a); let hit = 0;
  for (const t of b) if (A.has(t)) hit++;
  return hit / Math.sqrt(a.length * b.length);
}
export function fingerprint(kind: string, text: string, due?: number): string {
  const norm = tokens(text).slice(0, 6).sort().join("|");
  return `${kind}::${norm}${due ? "::" + Math.floor(due / 86400000) : ""}`;
}
// Binary by design — only genuinely urgent-now signals earn "high"; everything
// else is "none", not a middle tier ("if it's not urgent now, it's not a priority").
function inferPriority(text: string): Priority {
  const lc = text.toLowerCase();
  return HIGH_PRIORITY_TOKENS.some((k) => lc.includes(k)) ? "high" : "none";
}
export function autoName(sentence: string, maxTokens = 6): string {
  const toks = sentence.trim().replace(/\s+/g, " ").split(" ").slice(0, maxTokens).join(" ");
  return toks.charAt(0).toUpperCase() + toks.slice(1);
}
function detectTags(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  if (/\blegal|court|lawsuit|attorney|statute|filing\b/.test(t)) out.push("legal");
  if (/\bmedical|doctor|clinic|prescription|hospital\b/.test(t)) out.push("medical");
  if (/\btax|irs|refund|w2|1099\b/.test(t)) out.push("finance");
  if (/\bfamily|birthday|anniversary|wedding\b/.test(t)) out.push("personal");
  if (/\bmeeting|zoom|call|standup|sync\b/.test(t)) out.push("work");
  if (/\bflight|hotel|itinerary|travel|passport\b/.test(t)) out.push("travel");
  if (/\bcode|repo|deploy|api|bug|refactor|pr\b/.test(t)) out.push("dev");
  return out;
}

// ── Date parsing (multi-format) ────────────────────────────────────────────
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function parseDate(text: string, now = Date.now()): number | undefined {
  const t = text.toLowerCase();
  const d = new Date(now);

  // "in N minutes/hours/days/weeks"
  const rel = t.match(/\bin\s+(\d+)\s+(minute|min|hour|hr|day|week|month)s?\b/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const map: Record<string, number> = { minute:60e3, min:60e3, hour:3600e3, hr:3600e3, day:86400e3, week:604800e3, month:2592e6 };
    return now + n * map[unit];
  }

  if (/\btonight\b/.test(t)) { d.setHours(20, 0, 0, 0); return d.getTime(); }
  if (/\btomorrow\b/.test(t)) { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); }
  if (/\bnext week\b/.test(t)) return now + 7 * 86400e3;
  if (/\bnext month\b/.test(t)) return now + 30 * 86400e3;

  // "next monday", "on friday"
  const wk = t.match(/\b(?:next\s+|on\s+|by\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wk) {
    const target = WEEKDAYS.indexOf(wk[1]);
    const delta = (target - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + delta); d.setHours(9, 0, 0, 0);
    return d.getTime();
  }

  // "July 17 2026" / "Jul 17, 2026" / "July 17"
  const md = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/);
  if (md) {
    const m = MONTHS.indexOf(md[1]);
    const day = parseInt(md[2], 10);
    const year = md[3] ? parseInt(md[3], 10) : d.getFullYear();
    const stamp = new Date(year, m, day, 9, 0, 0, 0).getTime();
    if (!md[3] && stamp < now) return new Date(year + 1, m, day, 9).getTime();
    return stamp;
  }

  // ISO / US "2026-07-17" or "7/17/2026"
  const iso = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], 9).getTime();
  const us = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (us) { const y = us[3].length === 2 ? 2000 + +us[3] : +us[3]; return new Date(y, +us[1] - 1, +us[2], 9).getTime(); }

  return undefined;
}

// ── Project matcher ────────────────────────────────────────────────────────
// Two-tier: an EXPLICIT backward-reference ("my previous case", "add this to
// the Henderson project") is a deliberate pointer — it gets looked up against
// existing projects only, with a low bar, because the user named it on
// purpose. Absent that, ambient attachment uses a much higher bar so a new,
// unrelated conversation doesn't silently bleed into an old project just
// because a few words happen to overlap.
function bestOverlap(toks: string[], projects: Project[], threshold: number): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const p of projects) {
    const s = overlap(toks, tokens(p.name));
    if (s > threshold && (!best || s > best.score)) best = { id: p.id, score: s };
  }
  return best;
}

function findMatchingProject(text: string, existingProjects: Project[], freshVirtual: Project[] = []): string | undefined {
  for (const pat of PREVIOUS_PROJECT_HINTS) {
    const m = text.match(pat);
    if (m && m[1]) {
      const refHit = bestOverlap(tokens(m[1]), existingProjects, 0.12);
      if (refHit) return refHit.id;
    }
  }
  const all = [...existingProjects, ...freshVirtual];
  if (!all.length) return undefined;
  return bestOverlap(tokens(text), all, 0.4)?.id;
}

// ── Segment splitter — sentence-ish clauses ────────────────────────────────
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter((s) => s.length > 8 && s.length < 400);
}

// ── Main extractor ─────────────────────────────────────────────────────────
export function smartGen(
  text: string,
  context: { projects: Project[]; memories: Memory[]; reminders: Reminder[]; seen: Record<string, boolean> },
): SmartBatch {
  const out: SmartBatch = { memories: [], reminders: [], projects: [] };
  if (!text || text.length < 6) return out;

  // Fresh project detection first — so downstream items can attach to it.
  const virtualProjects: Project[] = [...context.projects];
  for (const pat of PROJECT_HINTS) {
    const m = text.match(pat);
    if (m) {
      const nameRaw = (m[1] || m[2] || "").trim();
      if (nameRaw.length > 1 && nameRaw.length < 60) {
        const name = autoName(nameRaw, 5);
        const fp = fingerprint("project", name);
        if (!context.seen[fp] && !virtualProjects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          out.projects.push({ name, fingerprint: fp });
          virtualProjects.push({ id: `virt_${fp}`, name, tasks: [] });
        }
      }
    }
  }

  const freshVirtual = virtualProjects.slice(context.projects.length);
  for (const raw of sentences(text)) {
    const sentence = raw.replace(/\s+/g, " ").trim();
    const projectId = findMatchingProject(sentence, context.projects, freshVirtual);
    const tags = detectTags(sentence);
    const priority = inferPriority(sentence);
    const due = parseDate(sentence);

    // Explicit reminder: "remind me to X (by Y)"
    const rem = sentence.match(/\bremind\s+me\s+(?:to\s+)?(.+)/i);
    if (rem) {
      const title = autoName(rem[1].replace(/\s+(tomorrow|tonight|next week|next month|by [^,.]+|on [^,.]+|in \d+ [a-z]+)\b/gi, "").trim(), 8);
      const fp = fingerprint("reminder", title, due);
      if (!context.seen[fp]) out.reminders.push({ title, due, priority, projectId, progress: "todo", tags, fingerprint: fp, isTask: false });
      continue;
    }

    // Deadline / due detection → reminder (time-based)
    if (due && /\b(deadline|due|expires?|statute|filing|hearing|trial|by\s+)/i.test(sentence)) {
      const title = autoName(sentence.replace(/^(?:the|a|an)\s+/i, ""), 8);
      const fp = fingerprint("reminder", title, due);
      if (!context.seen[fp]) out.reminders.push({ title, due, priority: priority === "low" ? "med" : priority, projectId, progress: "todo", tags, fingerprint: fp, isTask: false });
      continue;
    }

    // Task cue: "I need to X" / "TODO" / "Should X"
    const task = sentence.match(/\b(?:i\s+(?:need|have)\s+to|todo:|task:|i\s+should|we\s+should)\s+(.+)/i);
    if (task) {
      const title = autoName(task[1], 8);
      const fp = fingerprint("task", title, due);
      if (!context.seen[fp]) out.reminders.push({ title, due, priority, projectId, progress: "todo", tags, fingerprint: fp, isTask: true });
      continue;
    }

    // Memory cue: "remember that/to X" or high-signal factual info tied to a project
    const mem = sentence.match(/\b(?:please\s+)?(?:remember|note|keep in mind|fyi)(?:\s+that|\s+to)?\s+(.+)/i);
    if (mem) {
      const content = mem[1].trim();
      const fp = fingerprint("memory", content);
      if (!context.seen[fp] && content.length > 4 && content.length < 320) out.memories.push({ content, tags, projectId, priority, fingerprint: fp });
      continue;
    }

    // Novel-fact memory: sentence yields a concrete fact bound to an existing project
    if (projectId && /\bis\s+\w|=|\d{4}|\d+\s*(usd|eur|gbp|days|weeks|months|years)\b/i.test(sentence) && sentence.length < 260) {
      const fp = fingerprint("memory", sentence);
      if (!context.seen[fp]) out.memories.push({ content: sentence, tags, projectId, priority, fingerprint: fp });
    }
  }

  return out;
}

// ── Type conversion ─────────────────────────────────────────────────────────
// Turns a plain item of one Smart Gen kind into the field-shape needed to
// create an item of another kind (e.g. Reminder → Memory, Memory → Artifact).
// Returns a plain object suitable for spreading into the matching reducer
// action ({type:"memory",...}, {type:"reminder",...}, {type:"project",...},
// {type:"artifact",...}) — it does not dispatch or mutate anything itself.
export type ConvertKind = "memory" | "reminder" | "project" | "artifact";
const ARTIFACT_KINDS = new Set(["timeline", "statement", "document", "custom"]);

export function convertItem(item: Record<string, any>, fromKind: ConvertKind, toKind: ConvertKind): Record<string, any> {
  const rawText: string = item?.content ?? item?.title ?? item?.name ?? "";
  const title: string = item?.title ?? item?.name ?? autoName(rawText, 8);
  const content: string = item?.content ?? item?.title ?? item?.name ?? "";
  const tags: string[] = Array.isArray(item?.tags) ? item.tags : [];
  const priority = item?.priority && item.priority !== "none" ? item.priority : "med";
  const projectId: string | undefined = item?.projectId;

  switch (toKind) {
    case "memory":
      return { content: fromKind === "memory" ? content : (content || title), tags, projectId, priority };
    case "reminder":
      return {
        title: fromKind === "reminder" ? title : autoName(title || content, 8),
        due: item?.due,
        priority,
        projectId,
        progress: item?.progress ?? "todo",
        tags,
        isTask: !!item?.isTask,
      };
    case "project":
      return { name: fromKind === "project" ? (item?.name || title) : autoName(title || content, 6) };
    case "artifact":
      return {
        title: title || autoName(content, 8),
        content: content || title,
        kind: ARTIFACT_KINDS.has(item?.kind) ? item.kind : "custom",
        projectId,
      };
    default:
      return item;
  }
}
