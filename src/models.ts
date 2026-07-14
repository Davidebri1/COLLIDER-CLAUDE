export type Tier = "free" | "pro" | "elite";
export type Category = "general" | "image" | "video" | "music" | "coding";

export type ModelDef = {
  id: string;
  label: string;
  short: string;
  desc: string;
  tier: Tier;
  category: Category[];
  weight: number;
  color: string;
  locked?: boolean;
};

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "general", label: "General" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "music", label: "Audio" },
  { id: "coding", label: "Coding" },
];

// ── Model roster — rebuilt 2026-07-13 against the live OpenRouter catalog ───
// (fetched directly, not guessed — see chat.ts ROUTES for the exact remote
// slugs). Curated for actual quality/reputation, not just "free = cheapest
// possible." No Opus, no Fable anywhere — this app offers unlimited
// messages, so per-request cost has to stay sane at every tier.
export const MODELS: ModelDef[] = [

  // ── General · Free (8) — real, current, reputable models per provider ────
  { id: "free/claude-haiku-4-5",    label: "Claude Haiku 4.5",   short: "Hai5", desc: "Anthropic's fast model. Sharp, reliable.",       tier: "free", category: ["general"],           weight: 1, color: "#f6a4c9" },
  { id: "free/gemini-3-5-flash",    label: "Gemini 3.5 Flash",   short: "G3.5F",desc: "Google's current flash model. 1M ctx.",          tier: "free", category: ["general"],           weight: 1, color: "#7fd8c4" },
  { id: "free/nemotron-super",      label: "Nemotron Super 120B",short: "NemS", desc: "NVIDIA's strong open MoE. 1M ctx.",              tier: "free", category: ["general"],           weight: 1, color: "#8ee878" },
  { id: "free/mistral-small",       label: "Mistral Small 3.2",  short: "MiSm", desc: "Mistral's current small model. Great value.",    tier: "free", category: ["general"],           weight: 1, color: "#ffb066" },
  { id: "free/command-r",           label: "Command R",          short: "CmdR", desc: "Cohere's generalist model.",                     tier: "free", category: ["general"],           weight: 1, color: "#f2c14e" },
  { id: "free/minimax-m2",          label: "MiniMax M2",         short: "MM2",  desc: "MiniMax's current flagship.",                    tier: "free", category: ["general"],           weight: 1, color: "#ff9e6b" },
  { id: "free/llama-4-scout",       label: "Llama 4 Scout",      short: "L4Sc", desc: "Meta's fast MoE. Great for everyday tasks.",     tier: "free", category: ["general"],           weight: 1, color: "#4be6b1" },
  { id: "free/qwen3-30b",           label: "Qwen3 30B",          short: "Qw3",  desc: "Alibaba's current mid-size model.",              tier: "free", category: ["general"],           weight: 1, color: "#e8c15a" },

  // ── General · Pro (4) ─────────────────────────────────────────────────────
  { id: "pro/gemini-3-1-pro",       label: "Gemini 3.1 Pro",     short: "G3.1P",desc: "Google's current flagship. 1M ctx.",            tier: "pro",  category: ["general"],           weight: 5, color: "#7fd8c4" },
  { id: "pro/claude-sonnet-5",      label: "Claude Sonnet 5",    short: "CS5",  desc: "Anthropic's best balanced model. 1M ctx.",       tier: "pro",  category: ["general"],           weight: 5, color: "#f6a4c9" },
  { id: "pro/gpt-5-6-terra",        label: "GPT-5.6 Terra",      short: "5.6T", desc: "OpenAI's current flagship. 1M+ ctx.",            tier: "pro",  category: ["general"],           weight: 5, color: "#d9d3c7" },
  { id: "pro/grok-4-5",             label: "Grok 4.5",           short: "Gr4.5",desc: "xAI's current model. Real-time knowledge.",      tier: "pro",  category: ["general"],           weight: 5, color: "#ff9e6b" },

  // ── General · Elite (4) — stronger, not egregiously priced, no Opus ──────
  { id: "elite/sonar-reasoning-pro",label: "Sonar Reasoning Pro", short: "Sonr", desc: "Perplexity's reasoning model. Live web-grounded.",tier: "elite", category: ["general"],          weight: 6, color: "#6bb8ff" },
  { id: "elite/mistral-large",      label: "Mistral Large 2512", short: "MiLg", desc: "Mistral's current flagship. Excellent value.",   tier: "elite", category: ["general"],          weight: 6, color: "#ffb066" },
  { id: "elite/nemotron-ultra",     label: "Nemotron Ultra 550B",short: "NemU", desc: "NVIDIA's largest open MoE. 1M ctx.",             tier: "elite", category: ["general"],          weight: 7, color: "#8ee878" },
  { id: "elite/gpt-5-6-sol-pro",    label: "GPT-5.6 Sol Pro",    short: "5.6S", desc: "OpenAI's top-end frontier model.",               tier: "elite", category: ["general"],          weight: 9, color: "#d9d3c7" },

  // ── Coding · Free (2) ─────────────────────────────────────────────────────
  { id: "free/qwen3-coder",         label: "Qwen3 Coder (free)", short: "Q3CF", desc: "Qwen3's coder model, free tier. 1M ctx.",        tier: "free", category: ["coding"],            weight: 2, color: "#e8c15a" },
  { id: "free/qwen-coder-32b",      label: "Qwen Coder 32B",     short: "QC32", desc: "Code-tuned Qwen, fast inference.",               tier: "free", category: ["coding"],            weight: 2, color: "#e8c15a" },

  // ── Coding · Pro (4) ──────────────────────────────────────────────────────
  { id: "pro/gpt-oss-20b",          label: "GPT-OSS 20B",        short: "OSS",  desc: "OpenAI's open-weight coding model.",             tier: "pro",  category: ["coding"],            weight: 3, color: "#d9d3c7" },
  { id: "pro/qwen3-coder",          label: "Qwen3 Coder",        short: "Q3C",  desc: "World's largest open coder. 1M ctx.",            tier: "pro",  category: ["coding"],            weight: 4, color: "#e8c15a" },
  { id: "pro/gpt-5-1-codex",        label: "GPT-5.1 Codex",      short: "5.1Cx",desc: "OpenAI's current dedicated code model.",         tier: "pro",  category: ["coding"],            weight: 5, color: "#d9d3c7" },
  { id: "pro/claude-sonnet-5-code", label: "Claude Sonnet 5",    short: "CS5C", desc: "Anthropic's best for agentic coding.",           tier: "pro",  category: ["coding"],            weight: 5, color: "#f6a4c9" },

  // ── Coding · Elite (3) — no Opus ──────────────────────────────────────────
  { id: "elite/codestral-2508",     label: "Codestral 2508",     short: "Cst",  desc: "Mistral's elite coder. 256k ctx.",               tier: "elite", category: ["coding"],           weight: 6, color: "#ffb066" },
  { id: "elite/qwen3-coder-plus",   label: "Qwen3 Coder Plus",   short: "Q3CP", desc: "Qwen3's pro code tier. 1M ctx.",                 tier: "elite", category: ["coding"],           weight: 7, color: "#e8c15a" },
  { id: "elite/kimi-k2-7-code",     label: "Kimi K2.7 Code",     short: "K2.7C",desc: "Moonshot's dedicated coding model.",             tier: "elite", category: ["coding"],           weight: 7, color: "#4be6b1" },

  // ── Image · Free (1) — Pollinations, genuinely keyless/free (no account
  // of ours is being billed for this one) — a real taste of image gen for
  // free-tier users instead of the category being a locked wall entirely ──
  { id: "img/flux-free",              label: "FLUX (free)",             short: "FluxF",desc: "Free, fast image generator.",                tier: "free", category: ["image"],             weight: 1, color: "#8ee878" },

  // ── Image · Pro (2) — real OpenRouter image models, not Pollinations ─────
  { id: "img/gemini-3-1-flash-image", label: "Gemini 3.1 Flash Image", short: "G3.1I", desc: "Google's fast image generator.",            tier: "pro",  category: ["image"],             weight: 2, color: "#7fd8c4" },
  { id: "img/gpt-5-image-mini",       label: "GPT-5 Image Mini",       short: "5Img-",desc: "OpenAI's compact image model.",              tier: "pro",  category: ["image"],             weight: 3, color: "#d9d3c7" },

  // ── Image · Elite (2) ────────────────────────────────────────────────────
  { id: "img/gemini-3-pro-image",     label: "Gemini 3 Pro Image",     short: "G3Img",desc: "Google's flagship image model.",             tier: "elite", category: ["image"],            weight: 6, color: "#7fd8c4" },
  { id: "img/gpt-5-image",            label: "GPT-5 Image",            short: "5Img", desc: "OpenAI's flagship image model.",             tier: "elite", category: ["image"],            weight: 8, color: "#d9d3c7" },

  // ── Video · Pro (3) ──────────────────────────────────────────────────────
  { id: "vid/runway-gen2",          label: "Runway Gen-2",       short: "Runw", desc: "Sleek scene planning.",                          tier: "pro",  category: ["video"],             weight: 10, color: "#4dcaff" },
  { id: "vid/pika-2",               label: "Pika 2.0",           short: "Pika", desc: "Fast action storyboards.",                       tier: "pro",  category: ["video"],             weight: 12, color: "#ffd166" },
  { id: "vid/kling-ai",             label: "Kling AI",           short: "Klin", desc: "High motion synthesis.",                         tier: "pro",  category: ["video"],             weight: 12, color: "#c4b5fd" },

  // ── Video · Elite (3) ────────────────────────────────────────────────────
  { id: "vid/sora-2",               label: "Sora 2",             short: "Sora", desc: "AI-written storyboard + reference frame.",       tier: "elite", category: ["video"],            weight: 30, color: "#8076ff" },
  { id: "vid/veo-3",                label: "Veo 3",              short: "Veo",  desc: "AI-written storyboard + reference frame.",       tier: "elite", category: ["video"],            weight: 30, color: "#ff6ba0" },
  { id: "vid/luma-dream",           label: "Luma Dreamer",       short: "Luma", desc: "Fluid camera panning.",                          tier: "elite", category: ["video"],            weight: 24, color: "#a46cff" },

  // ── Music · Pro (3) ──────────────────────────────────────────────────────
  { id: "mus/suno",                 label: "Suno",               short: "Suno", desc: "AI lyrics + arrangement notes.",                 tier: "pro",  category: ["music"],             weight: 8,  color: "#ff69c8" },
  { id: "mus/musiclm",              label: "MusicLM",            short: "MusL", desc: "Ambient soundscape designer.",                   tier: "pro",  category: ["music"],             weight: 6,  color: "#8ee878" },
  { id: "mus/riffusion",            label: "Riffusion",          short: "Riff", desc: "Beat composition loop.",                         tier: "pro",  category: ["music"],             weight: 6,  color: "#5dbdff" },

  // ── Music · Elite (3) ────────────────────────────────────────────────────
  { id: "mus/udio",                 label: "Udio",               short: "Udio", desc: "AI composition + arrangement notes.",            tier: "elite", category: ["music"],            weight: 10, color: "#ff8a65" },
  { id: "mus/jukebox",              label: "Jukebox",            short: "Juke", desc: "High-fidelity arrangement.",                     tier: "elite", category: ["music"],            weight: 12, color: "#c4b5fd" },
  { id: "mus/suno-pro",             label: "Suno Pro",           short: "SuPr", desc: "Vocals orchestration.",                          tier: "elite", category: ["music"],            weight: 12, color: "#cc71ff" },
];

export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, elite: 2 };
export const TIER_INFO: Record<Tier, { label: string; pool: number; price: string; color: string }> = {
  // Free tier has zero access to credit-spending categories (media gen,
  // coding — see SPEC.md tiers section), so a nonzero pool here was showing
  // users a "300 credits" number they could never actually spend on anything.
  free:  { label: "Free",  pool: 0,    price: "$0",       color: "#4be6b1" },
  pro:   { label: "Pro",   pool: 3000, price: "$19.99/mo", color: "#a46cff" },
  elite: { label: "Elite", pool: 9000, price: "$49.99/mo", color: "#ffb74d" },
};

export function modelsForCategory(category: Category) {
  return MODELS.filter((m) => m.category.includes(category))
    .sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.weight - b.weight);
}
export function modelById(id: string) { return MODELS.find((m) => m.id === id); }
export function canUse(tier: Tier, model: ModelDef) {
  return !model.locked && TIER_RANK[tier] >= TIER_RANK[model.tier];
}
export function isCategoryUnlocked(tier: Tier, category: Category) {
  if (category === "general") return true;
  return MODELS.some((m) => m.category.includes(category) && TIER_RANK[tier] >= TIER_RANK[m.tier]);
}
