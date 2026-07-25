// MiniMax M3 via NVIDIA NIM — Smart Gen's dedicated model. One model does
// all of Smart Gen's thinking: background extraction (llmExtract.ts routes
// here first), the consensus arbiter (chat.ts routes here first), and the
// board chat. Qualifying one model qualifies every judgment it makes — the
// logic-chain validation in scripts/validate-logic-chain.mjs runs against
// exactly this model/endpoint/posture.
//
// Slug verified live against the key's /v1/models listing (minimaxai/minimax-m3
// exists; a completion round-trips) — not guessed.
import type { ChatMessage } from "../state";
import { callOpenRouter, readSSEStream, webSearch } from "./chat";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
export const MINIMAX_MODEL = "minimaxai/minimax-m3";
// Same stance as chat.ts: user explicitly requested keys ship in-app; the
// env override exists so a rotated key never requires a code change.
const NVIDIA_KEY =
  process.env.EXPO_PUBLIC_NVIDIA_API_KEY ||
  "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";

export type MiniMaxOptions = {
  temperature?: number;
  maxTokens?: number;
  onToken?: (partial: string) => void;
};

// Low-level OpenAI-compatible call. MiniMax M3 is a reasoning model — first
// tokens can take 10-20s, which is fine for background extraction and
// tolerable in the board chat with streaming on.
export async function callMiniMax(messages: any[], opts: MiniMaxOptions = {}): Promise<string> {
  // The free NVIDIA key throttles readily under concurrent load — two paced
  // retries turn most transient 429s into a short wait instead of a failure.
  // Safe with streaming too: a retry only happens before res.ok, i.e. before
  // any token has reached the caller.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2500 * attempt + Math.random() * 1000));
    let res: Response;
    try {
      res = await fetch(NVIDIA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_KEY}` },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          messages,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.maxTokens ?? 4096,
          stream: !!opts.onToken,
        }),
      });
    } catch (e) {
      // NVIDIA's NIM endpoint sends no CORS headers, so on web the browser
      // kills this fetch before it leaves (verified live: Node round-trips,
      // browser throws "Failed to fetch"). Same model, different host:
      // OpenRouter serves minimax-m3 with browser CORS. Still one judge —
      // only the wire changes.
      lastErr = e;
      break;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`MiniMax ${res.status}`);
      continue;
    }
    if (!res.ok) throw new Error(`MiniMax ${res.status}: ${(await res.text()).slice(0, 200)}`);
    if (!opts.onToken) {
      const json = await res.json();
      return json.choices?.[0]?.message?.content ?? "";
    }
    return readSSEStream(res, opts.onToken);
  }
  try {
    return await callOpenRouter("minimax/minimax-m3", messages, opts.onToken, { temperature: opts.temperature, maxTokens: opts.maxTokens ?? 4096 });
  } catch {
    throw lastErr || new Error("MiniMax unavailable");
  }
}

// ── Board-chat action protocol ──────────────────────────────────────────────
// The board chat doesn't just talk about cards — it changes them. The model
// appends one fenced block of strict JSON actions after its prose; the board
// screen parses and dispatches them. Everything the user can do by hand, the
// model can do in the same reply that explains it — value delivered in the
// turn, never dangled as an offer.
type Recurring = "daily" | "weekly" | "monthly" | "yearly" | "weekdays" | "weekends";
export type BoardAction =
  | { action: "create"; cardType: "project" | "reminder" | "memory" | "artifact"; title: string; content?: string; due?: string; priority?: "high" | "none"; recurring?: Recurring; tags?: string[]; projectName?: string; isTask?: boolean; fields?: Record<string, string> }
  | { action: "update"; cardId: string; title?: string; content?: string; due?: string | null; priority?: "high" | "none"; progress?: "todo" | "inprogress" | "done"; recurring?: Recurring | null; tags?: string[]; fields?: Record<string, string> }
  | { action: "convert"; cardId: string; toType: "project" | "reminder" | "memory" | "artifact" }
  | { action: "embed"; cardId: string; intoCardId: string }
  | { action: "defineField"; name: string; fieldType: "text" | "number" | "date" | "datetime" | "checkbox" | "select"; options?: string[]; cardTypes?: ("project" | "reminder" | "memory" | "artifact")[] }
  | { action: "board"; view?: "board" | "list" | "calendar"; groupBy?: string; sortBy?: "due" | "created" | "priority" | "title" };

const ACTIONS_FENCE = /```collider-actions\s*([\s\S]*?)```/;

export function parseBoardActions(reply: string): { prose: string; actions: BoardAction[] } {
  const m = reply.match(ACTIONS_FENCE);
  if (!m) return { prose: reply.trim(), actions: [] };
  const prose = reply.replace(ACTIONS_FENCE, "").trim();
  try {
    const parsed = JSON.parse(m[1]);
    return { prose, actions: Array.isArray(parsed) ? parsed.filter((a) => a && typeof a.action === "string") : [] };
  } catch {
    return { prose, actions: [] };
  }
}

export type BoardCardBrief = {
  id: string;
  type: "project" | "reminder" | "memory" | "artifact";
  title: string;
  due?: number;
  priority?: string;
  progress?: string;
  recurring?: string;
  tags?: string[];
  projectName?: string;
  embeds?: number;
  fields?: Record<string, string>;
};

const SMARTGEN_SYSTEM = [
  "You are Smart Gen — the intelligence behind this user's board of cards (projects, reminders, memories, artifacts).",
  "You see the full board below. Answer from it directly. When the user asks what's left, what's due, or what exists, resolve it from the board — never ask them to check something you can see.",
  "Act, don't offer. If the user's message implies a card should exist, change, or be produced (a list, a plan, a document), do it in THIS reply via the action block — then briefly say what you did. Never say 'I can create that for you — want me to?'. The user can delete anything unwanted; a dangled offer helps no one.",
  "Only ask a question when the causal chain is genuinely broken — a variable you cannot resolve from the board, the conversation, or common-sense inference. Infer freely when inference is logical; ask only where mutually exclusive readings truly remain.",
  "To change the board, end your reply with ONE fenced block exactly like:",
  "```collider-actions",
  '[{"action":"create","cardType":"reminder","title":"...","due":"YYYY-MM-DD","priority":"high","tags":["legal"]}]',
  "```",
  'Available actions: create (cardType project|reminder|memory|artifact; optional content, due "YYYY-MM-DD" or "YYYY-MM-DD HH:MM", priority high|none, recurring daily|weekly|monthly|yearly|weekdays|weekends, tags, projectName, isTask, fields), update (cardId + any of title/content/due/priority/progress/recurring/tags/fields), convert (cardId, toType), embed (cardId, intoCardId — either direction, any types), defineField (name, fieldType text|number|date|datetime|checkbox|select, options for select, cardTypes to attach as a default), board (view/groupBy/sortBy — groupBy accepts status|type|priority|project|tag or "field:<Name>" to swimlane by any attribute).',
  "URGENT (priority high) is binary and carries a deadline — the system defaults to now+12h if you omit one. CRITICAL is a separate binary attribute (checkbox field 'Critical'): it marks dependency, not time, and generates no deadline.",
  "Cards embed freely into each other in either direction and convert freely between types — use that to put things where they're relevant (an ingredient-list artifact embedded in the dinner reminder, a filing-form artifact embedded in the deadline card).",
  "Attributes are what make a set of cards comparable and groupable — fill the ones that exist, and define new ones with defineField when a set needs them (a score to sort by, a category whose options become swimlanes).",
  "Omit the block entirely when nothing on the board should change.",
].join("\n");

export async function smartGenChat(
  history: ChatMessage[],
  prompt: string,
  board: BoardCardBrief[],
  opts: { webSearch?: boolean; onToken?: (partial: string) => void; fieldDefs?: Record<string, { name: string; type: string; options?: string[] }> } = {},
): Promise<string> {
  const boardJson = JSON.stringify(board).slice(0, 24000);
  const sysParts = [SMARTGEN_SYSTEM, `CURRENT BOARD (${board.length} cards):\n${boardJson}`, `Today's date: ${new Date().toISOString().split("T")[0]}`];
  if (opts.fieldDefs && Object.keys(opts.fieldDefs).length) {
    sysParts.push(`DEFINED ATTRIBUTES (use these before defining new ones):\n${JSON.stringify(Object.values(opts.fieldDefs))}`);
  }
  if (opts.webSearch && prompt) {
    const results = await webSearch(prompt, "smartgen");
    if (results) sysParts.push(`Live web search results — source of truth for anything current or outside training data:\n\n${results}`);
  }
  const messages: any[] = [{ role: "system", content: sysParts.join("\n\n") }];
  for (const m of history.slice(-20)) messages.push({ role: m.role, content: m.content });
  messages.push({ role: "user", content: prompt });
  return callMiniMax(messages, { onToken: opts.onToken });
}
