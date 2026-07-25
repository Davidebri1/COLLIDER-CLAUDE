import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CATEGORIES, TIER_INFO, canUse, modelsForCategory, type Category, type Tier } from "./models";
import { smartGen, tokens, overlap, type SmartBatch } from "./services/smartgen";
import { type LLMBatch } from "./services/llmExtract";
import { getValidAccessToken } from "./services/googleAuth";
import { createCalendarEvent } from "./services/googleCalendar";

// Fingerprints only catch near-identical phrasing. A reworded restatement of
// the same fact ("filing deadline is July 17" vs "the deadline to file is
// 7/17") would pass the fingerprint check and still get double-captured —
// this catches that by token-overlap against what's already there, same
// technique the project matcher uses, just against existing item text
// instead of project names.
function isSemanticDuplicate(text: string, existing: string[], threshold = 0.6): boolean {
  if (!text) return false;
  const toks = tokens(text);
  for (const e of existing) {
    if (overlap(toks, tokens(e)) > threshold) return true;
  }
  return false;
}

export type WallpaperId = string; // preset IDs: "default"|"aurora"|"cove"|"inferno"|"quartz"|"magnolia"|"voyager" + dynamic free_*/premium_* drop-in IDs
// Priority is binary by design — "if it's not urgent now, it's not a
// priority." No low/med tiers; "low"/"med" are kept in the union only so
// old persisted data doesn't hard-crash on load, but nothing should ever
// write them again (see collapsePriority()).
export type Priority = "high" | "none" | "low" | "med";
export function collapsePriority(p: Priority | undefined): "high" | "none" {
  return p === "high" ? "high" : "none";
}
export type Progress = "todo" | "inprogress" | "done";

export type Attachment = { kind: "image"; dataUri: string; mime: string };
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; ts: number; modelId?: string; streaming?: boolean };
export type Conversation = { id: string; title: string; tab: Category; createdAt: number; archived?: boolean; threads: Record<string, ChatMessage[]> };
// Cross-linking bag shared by Memory/Reminder/Project/Artifact — optional so
// existing items don't need to carry it; use linkItems() to populate it.
export type SmartLinks = { memories: string[]; reminders: string[]; projects: string[]; artifacts: string[] };
// Directional containment, distinct from links: an embed puts card B *inside*
// card A's body (a form artifact living inside the deadline reminder it
// serves; a reminder pinned inside a project card). Any kind can embed any
// kind, both directions, including its own kind — no type bounds by design.
export type CardEmbed = { kind: LinkKind; id: string };
export type Memory = { id: string; modelId: string; content: string; ts: number; tags?: string[]; projectId?: string; priority?: Priority; fingerprint?: string; links?: SmartLinks; embeds?: CardEmbed[]; customFields?: Record<string, string> };
export type Reminder = {
  id: string;
  title: string;
  due?: number;
  done: boolean;
  ts: number;
  priority?: Priority;
  projectId?: string;
  progress?: Progress;
  tags?: string[];
  fingerprint?: string;
  isTask?: boolean;
  modelId?: string;
  calendarId?: string;
  calendarTitle?: string;
  time?: string;
  date?: string;
  links?: SmartLinks;
  googleEventId?: string;
  googleTaskId?: string;
  // Optional by design — many reminders are logically unconstrained by time
  // ("eventually"); the field's availability is what matters, not its use.
  // weekdays/weekends give calendar-app parity without a full RRULE engine.
  recurring?: "daily" | "weekly" | "monthly" | "yearly" | "weekdays" | "weekends";
  embeds?: CardEmbed[];
  customFields?: Record<string, string>;
};
export type Project = { id: string; name: string; tasks: { id: string; title: string; done: boolean; priority?: Priority }[]; fingerprint?: string; modelId?: string; links?: SmartLinks; embeds?: CardEmbed[]; customFields?: Record<string, string> };
export type Artifact = {
  id: string;
  title: string;
  content: string;
  kind: "timeline" | "statement" | "document" | "custom";
  modelId?: string;
  projectId?: string;
  ts: number;
  fingerprint?: string;
  customFields?: Record<string, string>;
  links?: SmartLinks;
  embeds?: CardEmbed[];
};
export type ColliderFile = { id: string; name: string; kind: "uploaded" | "generated"; url: string; ts: number; modelId?: string };
export type GenerationItem = {
  id: string;
  prompt: string;
  modelId: string;
  category: Category;
  url: string;
  ts: number;
  content?: string;
};
export type ConsensusRun = {
  id: string; ts: number; prompt: string; category: Category;
  ratioN: number; ratioM: number; verdict: string;
  dissenters: { modelId: string; point: string }[];
};
export type AuthUser = { kind: "guest" } | { kind: "email"; email: string } | { kind: "google"; email: string } | { kind: "apple"; email: string };
export type ChatMode = "default" | "research" | "deep";

// ── Smart Gen board (kanban) ────────────────────────────────────────────────
// The board is many things depending on what the content is: vertical
// swimlanes (board), horizontal swimlanes (lanes), a week or month calendar,
// a paged sequence (storyboard / photobook / lore book / journal — one
// primitive, different content), or an inside/outside circle. All of them
// render the same cards through the same grouping engine.
export type BoardView = "board" | "lanes" | "list" | "calendar" | "week" | "month" | "pages" | "circle";
// "field:<Name>" groups by any typed custom attribute — that IS a swimlane
// view: a select field's options are the prescriptive lanes, values observed
// on cards extend them deductively, and renaming/adding lanes is just
// editing the field definition.
export type BoardGroupBy = "type" | "status" | "priority" | "project" | "tag" | `field:${string}`;
// "manual" is the default: where you put a card IS the sort. The others are
// there for anyone who wants them, and dragging a card switches back to
// manual so a sort never silently undoes a placement.
export type BoardSortBy = "manual" | "due" | "created" | "priority" | "title" | "updated" | "type" | `field:${string}`;
export type BoardConfig = {
  view: BoardView;
  groupBy: BoardGroupBy;
  sortBy: BoardSortBy;
  filter: string;
  // Card placement, by "<kind>:<id>". Physical position is the user's own
  // decision and reads back as their reasoning — so it persists.
  order: Record<string, number>;
  hideDone: boolean;
  circleField: string;
  page: number;
};
// Global per-type attribute availability — which custom-field names a card
// of each type presents by default. Per-card customFields extend/override
// these. Editable by the user AND by the model (setTypeFields).
export type CardTypeFields = Record<LinkKind, string[]>;
// Deliberately sparse. A field that is present but empty is dead weight on a
// card — availability comes from the attribute registry and the model, not
// from pre-seeding every card with blanks.
export const DEFAULT_CARD_TYPE_FIELDS: CardTypeFields = {
  project: [],
  reminder: ["Critical"],
  memory: [],
  artifact: [],
};

// Typed attribute definitions — a field is not just a label, it has a type
// that defines how it's entered, displayed, and grouped on. "select" carries
// its options (prescriptive swimlanes); values observed on cards extend them
// (deductive). Values are stored as strings on customFields regardless of
// type; checkbox uses "yes"/"" so absence and unchecked read the same.
export type FieldType = "text" | "number" | "date" | "datetime" | "checkbox" | "select";
export type FieldDef = { name: string; type: FieldType; options?: string[] };
export const DEFAULT_FIELD_DEFS: Record<string, FieldDef> = {
  // Critical is binary by nature — a dependency exists or it doesn't. Unlike
  // Urgent it does not observe time, so it never generates a deadline.
  Critical: { name: "Critical", type: "checkbox" },
  // Intermediate states are write-in on purpose. "Started" says nothing the
  // card's existence doesn't, and "in progress" is a status report, not a
  // fact about the work — the only state that changes anything is done or
  // not. This field stays available for anyone whose workplace needs it.
  Status: { name: "Status", type: "text" },
  Goal: { name: "Goal", type: "text" },
  Source: { name: "Source", type: "text" },
};

function upsertAsset(state: { savedAssets: SavedAsset[] }, asset: SavedAsset): SavedAsset[] {
  return state.savedAssets.some((a) => a.id === asset.id)
    ? state.savedAssets
    : [asset, ...state.savedAssets];
}

export type SavedAsset = {
  id: string;              // stable: market item id, or gen:<ts> for local
  kind: "image" | "video" | "audio" | "coding";
  url: string;
  prompt: string;
  modelId?: string;
  savedAt: number;
};

export type SavedCollection = {
  id: string;
  name: string;
  assetIds: string[];
  createdAt: number;
};

export type MarketItem = { id: string; kind: "image" | "video" | "audio" | "coding"; prompt: string; model: string; author: string; likes: number; likedByUser?: boolean; url?: string; category?: string };

export type AppState = {
  tier: Tier;
  credits: number;
  dailyMessagesSent: number;
  lastMessageResetDate: string;
  monthlyMessagesSent: number;
  lastMonthReset: string;
  lastCreditResetDate: string;
  activeCategory: Category;
  selectedModelIds: Record<Category, string[]>;
  activeConversationId: Record<Category, string>;
  // Which custom agent (if any) is currently "in use" for a given category's
  // chats — mirrors activeConversationId's per-category shape. Null means no
  // agent persona is layered on top of the base model for that tab.
  activeAgentId: Record<Category, string | null>;
  // Which project a given conversation is already "about", once Smart Gen
  // has attached something to one — lets later extraction passes in the same
  // conversation default to that project instead of re-guessing from scratch
  // (and instead of bleeding into an older, superficially-similar project).
  conversationProjectId: Record<string, string>;
  cardPrompts: Record<Category, Record<string, string>>;
  chatMode: Record<Category, ChatMode>;
  webSearch: Record<Category, boolean>;
  conversations: Conversation[];
  memories: Memory[];
  reminders: Reminder[];
  projects: Project[];
  artifacts: Artifact[];
  files: ColliderFile[];
  generations: GenerationItem[];
  consensusRuns: ConsensusRun[];
  wallpaper: WallpaperId;
  autoGen: boolean;
  incognito: Record<Category, boolean>;
  auth: AuthUser;
  hydrated: boolean;
  seen: Record<string, boolean>;
  // Settings — competitor parity
  sendOnEnter: boolean;
  messageDensity: "compact" | "comfortable" | "spacious";
  autoScroll: boolean;
  language: string;
  fontSize: "small" | "medium" | "large";
  showModelDescriptions: boolean;
  smartGenNotifications: boolean;
  globalDefaultChatMode: ChatMode;
  autoWipeOnConsensus: boolean;
  autoArchiveOnNew: boolean;
  gridRows: 1 | 2 | 3;
  // Proactive-value philosophy: the Collide bar auto-fills with a short
  // consensus synthesis as soon as 2+ models have replied, instead of
  // requiring the user to open a drawer to find out models agree. This is
  // the opt-out for that — off means the bar goes back to a plain "tap to
  // compare" button.
  autoConsensusSummary: boolean;
  smartBoard: BoardConfig;
  cardTypeFields: CardTypeFields;
  fieldDefs: Record<string, FieldDef>;
  customAgents: { id: string; name: string; modelId: string; instructions: string }[];
  customInstructions: string;
  activeSkills: string[];
  marketItems: MarketItem[];
  // Wallpapers & Music (SPEC.md) — live video wallpapers are individually
  // purchased, each bundled with curated tracks. ownedWallpaperIds gates
  // both the wallpaper itself and its bundled tracks in the player.
  ownedWallpaperIds: string[];
  // Collections & favorites (spec: media-gen action bar minimum includes
  // "save to collection (in app)" and "favorite icon"). These are app-wide,
  // not Market-local: the same asset saved from a generation result, the
  // Market, or an exploded view lands in the same place. Keyed by a stable
  // asset id so a Market item and a local generation can coexist.
  collections: SavedCollection[];
  favoriteAssetIds: string[];
  // Single registry so an asset referenced by a collection AND by favorites
  // is stored once, not duplicated per list.
  savedAssets: SavedAsset[];
  musicPlayer: {
    trackId: string | null;
    isPlaying: boolean;
    volume: number; // 0..1
    muted: boolean;
    // Per-track on/off within the owned playlist — spec: "each track can be
    // toggled on or off in the playlist," independent of play/pause.
    disabledTrackIds: string[];
  };
};

type Action =
  | { type: "hydrate"; state: Partial<AppState> }
  | { type: "category"; category: Category }
  | { type: "tier"; tier: Tier }
  | { type: "toggleModel"; category: Category; modelId: string }
  | { type: "newConversation"; category: Category }
  | { type: "loadConversation"; category: Category; id: string }
  | { type: "append"; category: Category; modelId: string; message: ChatMessage; convId?: string }
  | { type: "replaceLastAssistant"; category: Category; modelId: string; content: string; streaming?: boolean; convId?: string }
  | { type: "deleteMessage"; category: Category; modelId: string; messageId: string; convId?: string }
  | { type: "cardPrompt"; category: Category; modelId: string; value: string }
  | { type: "chatMode"; category: Category; mode: ChatMode }
  | { type: "webSearch"; category: Category; enabled: boolean }
  | { type: "memory"; id?: string; content: string; modelId?: string; tags?: string[]; projectId?: string; priority?: Priority; fingerprint?: string; linkFrom?: LinkRef }
  | { type: "removeMemory"; id: string }
  | { type: "removeMemories"; ids: string[] }
  | { type: "updateMemory"; memory: Memory }
  | { type: "reminder"; id?: string; title: string; due?: number; priority?: Priority; projectId?: string; progress?: Progress; tags?: string[]; fingerprint?: string; isTask?: boolean; modelId?: string; calendarId?: string; calendarTitle?: string; time?: string; date?: string; recurring?: Reminder["recurring"]; linkFrom?: LinkRef }
  | { type: "toggleReminder"; id: string }
  | { type: "cycleReminderProgress"; id: string }
  | { type: "removeReminder"; id: string }
  | { type: "removeReminders"; ids: string[] }
  | { type: "updateReminder"; reminder: Reminder }
  | { type: "project"; id?: string; name: string; fingerprint?: string; modelId?: string; linkFrom?: LinkRef }
  | { type: "removeProject"; id: string }
  | { type: "removeProjects"; ids: string[] }
  | { type: "updateProject"; project: Project }
  | { type: "artifact"; id?: string; title: string; content: string; kind: Artifact["kind"]; modelId?: string; projectId?: string; fingerprint?: string; customFields?: Record<string, string>; linkFrom?: LinkRef }
  | { type: "removeArtifact"; id: string }
  | { type: "removeArtifacts"; ids: string[] }
  | { type: "updateArtifact"; artifact: Artifact }
  | { type: "linkItems"; a: { kind: LinkKind; id: string }; b: { kind: LinkKind; id: string } }
  | { type: "unlinkItems"; a: { kind: LinkKind; id: string }; b: { kind: LinkKind; id: string } }
  | { type: "embedCard"; host: CardEmbed; card: CardEmbed }
  | { type: "unembedCard"; host: CardEmbed; card: CardEmbed }
  | { type: "setCardFields"; ref: CardEmbed; fields: Record<string, string> }
  | { type: "setTypeFields"; kind: LinkKind; fields: string[] }
  | { type: "defineField"; def: FieldDef; cardTypes?: LinkKind[] }
  | { type: "removeFieldDef"; name: string }
  | { type: "setBoardConfig"; config: Partial<BoardConfig> }
  | { type: "reorderCards"; keys: string[] }
  | { type: "convertCard"; ref: CardEmbed; toKind: LinkKind }
  | { type: "applySmartBatch"; batch: LLMBatch; modelId?: string; convId?: string }
  | { type: "task"; projectId: string; title: string; priority?: Priority }
  | { type: "updateTask"; projectId: string; task: { id: string; title: string; done: boolean; priority?: Priority } }
  | { type: "removeTask"; projectId: string; taskId: string }
  | { type: "toggleTask"; projectId: string; taskId: string }
  | { type: "file"; file: Omit<ColliderFile, "id" | "ts"> }
  | { type: "removeFile"; id: string }
  | { type: "removeFiles"; ids: string[] }
  | { type: "updateFile"; file: ColliderFile }
  | { type: "addGeneration"; generation: Omit<GenerationItem, "id" | "ts"> }
  | { type: "removeGeneration"; id: string }
  | { type: "removeGenerations"; ids: string[] }
  | { type: "consensus"; run: Omit<ConsensusRun, "id" | "ts"> }
  | { type: "removeConsensus"; id: string }
  | { type: "removeConsensuses"; ids: string[] }
  | { type: "removeConversations"; ids: string[] }
  | { type: "wallpaper"; wallpaper: WallpaperId }
  | { type: "autoGen"; enabled: boolean }
  | { type: "incognito"; category: Category; enabled: boolean }
  | { type: "auth"; user: AuthUser }
  | { type: "spend"; credits: number }
  // Returns credits taken by a generation that then failed. Deliberately a
  // separate action rather than a negative `spend`: `spend` refuses when the
  // balance is short (`credits < action.credits`), so a negative amount there
  // would be silently dropped exactly when the balance is lowest — i.e. the
  // case a refund matters most. Refund also must not trigger the daily-refill
  // branch, or a failure that straddles midnight would top the pool back up.
  | { type: "refund"; credits: number }
  | { type: "recordMessageSent" }
  | { type: "resetLimits" }
  | { type: "smartCapture"; text: string; modelId?: string; convId?: string }
  | { type: "setSendOnEnter"; value: boolean }
  | { type: "setMessageDensity"; value: "compact" | "comfortable" | "spacious" }
  | { type: "setAutoScroll"; value: boolean }
  | { type: "setLanguage"; value: string }
  | { type: "setFontSize"; value: "small" | "medium" | "large" }
  | { type: "setShowModelDescriptions"; value: boolean }
  | { type: "setSmartGenNotifications"; value: boolean }
  | { type: "setGlobalDefaultChatMode"; value: ChatMode }
  | { type: "setAutoWipeOnConsensus"; value: boolean }
  | { type: "setAutoArchiveOnNew"; value: boolean }
  | { type: "setGridRows"; value: 1 | 2 | 3 }
  | { type: "setAutoConsensusSummary"; value: boolean }
  | { type: "addCustomAgent"; agent: { name: string; modelId: string; instructions: string } }
  | { type: "updateCustomAgent"; agent: { id: string; name: string; modelId: string; instructions: string } }
  | { type: "removeCustomAgent"; id: string }
  | { type: "setActiveAgent"; category: Category; agentId: string | null }
  | { type: "setCustomInstructions"; value: string }
  | { type: "toggleSkill"; skillId: string }
  | { type: "publishToMarket"; item: Omit<MarketItem, "id" | "likes" | "likedByUser"> }
  | { type: "toggleMarketLike"; id: string }
  | { type: "loadMoreMarket"; count: number }
  | { type: "purchaseWallpaper"; wallpaperId: string }
  | { type: "toggleFavoriteAsset"; asset: SavedAsset }
  | { type: "saveToCollection"; collectionId: string; asset: SavedAsset }
  | { type: "createCollection"; name: string; asset?: SavedAsset }
  | { type: "removeFromCollection"; collectionId: string; assetId: string }
  | { type: "deleteCollection"; collectionId: string }
  | { type: "playTrack"; trackId: string }
  | { type: "pausePlayer" }
  | { type: "resumePlayer" }
  | { type: "setPlayerVolume"; volume: number }
  | { type: "togglePlayerMute" }
  | { type: "toggleTrackEnabled"; trackId: string };

const ids = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
// Lets a caller create-then-immediately-open-for-editing: generate the id
// up front, dispatch the create action with it, then open the edit modal
// for that known id instead of guessing which item was just created.
export function newId(prefix: string): string {
  return `${prefix}_${ids()}`;
}
const newConvId = () => `c_${ids()}`;

// ── Cross-linking (Memory/Reminder/Project/Artifact) ────────────────────────
export type LinkKind = "memory" | "reminder" | "project" | "artifact";
type LinkRef = { kind: LinkKind; id: string };
type LinkBagKey = keyof SmartLinks;

function emptyLinks(): SmartLinks {
  return { memories: [], reminders: [], projects: [], artifacts: [] };
}
function bagKeyFor(kind: LinkKind): LinkBagKey {
  return kind === "memory" ? "memories" : kind === "reminder" ? "reminders" : kind === "project" ? "projects" : "artifacts";
}
function arrayKeyFor(kind: LinkKind): "memories" | "reminders" | "projects" | "artifacts" {
  return bagKeyFor(kind);
}

// Pushes `targetId` into `ref`'s links bag for `targetKind`, if not already present.
function addLink(state: AppState, ref: LinkRef, targetKind: LinkKind, targetId: string): AppState {
  const arrKey = arrayKeyFor(ref.kind);
  const bagKey = bagKeyFor(targetKind);
  const list = (state as any)[arrKey] as any[];
  return {
    ...state,
    [arrKey]: list.map((item) => {
      if (item.id !== ref.id) return item;
      const links: SmartLinks = item.links || emptyLinks();
      if (links[bagKey].includes(targetId)) return item;
      return { ...item, links: { ...links, [bagKey]: [...links[bagKey], targetId] } };
    }),
  } as AppState;
}

// Bidirectionally links two Smart Gen items (of any kind, including the same
// kind) by id — e.g. linkItems(state, {kind:"reminder", id: r.id}, {kind:"artifact", id: a.id}).
export function linkItems(state: AppState, a: LinkRef, b: LinkRef): AppState {
  let next = addLink(state, a, b.kind, b.id);
  next = addLink(next, b, a.kind, a.id);
  return next;
}

function removeLink(state: AppState, ref: LinkRef, targetKind: LinkKind, targetId: string): AppState {
  const arrKey = arrayKeyFor(ref.kind);
  const bagKey = bagKeyFor(targetKind);
  const list = (state as any)[arrKey] as any[];
  return {
    ...state,
    [arrKey]: list.map((item) => {
      if (item.id !== ref.id || !item.links) return item;
      return { ...item, links: { ...item.links, [bagKey]: item.links[bagKey].filter((id: string) => id !== targetId) } };
    }),
  } as AppState;
}

// Inverse of linkItems() — detaches two items from each other.
export function unlinkItems(state: AppState, a: LinkRef, b: LinkRef): AppState {
  let next = removeLink(state, a, b.kind, b.id);
  next = removeLink(next, b, a.kind, a.id);
  return next;
}

// ── Card lookup / embedding / conversion ────────────────────────────────────
export function findCard(state: AppState, ref: CardEmbed): Memory | Reminder | Project | Artifact | undefined {
  const list = (state as any)[arrayKeyFor(ref.kind)] as any[];
  return list.find((x) => x.id === ref.id);
}

function mutateCard(state: AppState, ref: CardEmbed, fn: (item: any) => any): AppState {
  const arrKey = arrayKeyFor(ref.kind);
  const list = (state as any)[arrKey] as any[];
  return { ...state, [arrKey]: list.map((item) => (item.id === ref.id ? fn(item) : item)) } as AppState;
}

const ID_PREFIX: Record<LinkKind, string> = { memory: "m", reminder: "r", project: "p", artifact: "art" };

function cardTitle(kind: LinkKind, item: any): string {
  return kind === "memory" ? String(item.content || "").split(/[.!?\n]/)[0].trim().slice(0, 80) || "Memory"
    : kind === "project" ? item.name
    : item.title;
}

// Full-fidelity type conversion: any card kind becomes any other kind with
// nothing silently dropped. Links, embeds, custom fields, tags, priority and
// due all carry over; content the target kind has no native slot for lands in
// customFields.Notes; a converted-away project's tasks are serialized the
// same way. Every reference to the old card anywhere on the board (links
// bags, embeds arrays, projectId pointers) is rewritten to the new identity —
// conversion changes a card's form, never its place in the web around it.
export function convertCardInState(state: AppState, ref: CardEmbed, toKind: LinkKind): AppState {
  if (ref.kind === toKind) return state;
  const src: any = findCard(state, ref);
  if (!src) return state;

  const title = cardTitle(ref.kind, src);
  const content: string = ref.kind === "project"
    ? (src.tasks || []).map((t: any) => `${t.done ? "[x]" : "[ ]"} ${t.title}`).join("\n")
    : (src.content ?? "");
  const carried = {
    tags: src.tags,
    priority: src.priority,
    projectId: toKind === "project" ? undefined : src.projectId,
    links: src.links,
    embeds: src.embeds,
    modelId: src.modelId || "global",
    customFields: { ...(src.customFields || {}) } as Record<string, string>,
  };
  // Content with no native slot in the target kind is preserved, not dropped.
  const targetHoldsContent = toKind === "memory" || toKind === "artifact";
  if (content && !targetHoldsContent && content !== title) carried.customFields["Notes"] = content.slice(0, 2000);

  const newId = `${ID_PREFIX[toKind]}_${ids()}`;
  const ts = Date.now();
  let created: any;
  if (toKind === "memory") created = { id: newId, modelId: carried.modelId, content: content || title, ts, tags: carried.tags, projectId: carried.projectId, priority: carried.priority, links: carried.links, embeds: carried.embeds, customFields: carried.customFields };
  if (toKind === "reminder") created = { id: newId, title, due: src.due, done: false, ts, priority: carried.priority, projectId: carried.projectId, progress: src.progress || "todo", tags: carried.tags, isTask: !!src.isTask, modelId: carried.modelId, calendarTitle: "Personal Calendar", recurring: src.recurring, links: carried.links, embeds: carried.embeds, customFields: carried.customFields };
  if (toKind === "project") created = { id: newId, name: title, tasks: ref.kind === "project" ? src.tasks : [], modelId: carried.modelId, links: carried.links, embeds: carried.embeds, customFields: carried.customFields };
  if (toKind === "artifact") created = { id: newId, title, content: content || title, kind: "custom", modelId: carried.modelId, projectId: carried.projectId, ts, links: carried.links, embeds: carried.embeds, customFields: carried.customFields };

  const fromArr = arrayKeyFor(ref.kind);
  const toArr = arrayKeyFor(toKind);
  let next: AppState = { ...state, [fromArr]: ((state as any)[fromArr] as any[]).filter((x) => x.id !== ref.id) } as AppState;
  next = { ...next, [toArr]: [created, ...((next as any)[toArr] as any[])] } as AppState;

  // Rewrite every reference to the old identity across all four card arrays.
  const fromBag = bagKeyFor(ref.kind);
  const toBag = bagKeyFor(toKind);
  for (const arrKey of ["memories", "reminders", "projects", "artifacts"] as const) {
    next = {
      ...next,
      [arrKey]: ((next as any)[arrKey] as any[]).map((item) => {
        let changed = item;
        if (changed.links?.[fromBag]?.includes(ref.id)) {
          const links: SmartLinks = { ...changed.links, [fromBag]: changed.links[fromBag].filter((i: string) => i !== ref.id) };
          links[toBag] = links[toBag].includes(newId) ? links[toBag] : [...links[toBag], newId];
          changed = { ...changed, links };
        }
        if (changed.embeds?.some((e: CardEmbed) => e.kind === ref.kind && e.id === ref.id)) {
          changed = { ...changed, embeds: changed.embeds.map((e: CardEmbed) => (e.kind === ref.kind && e.id === ref.id ? { kind: toKind, id: newId } : e)) };
        }
        if (ref.kind === "project" && changed.projectId === ref.id) {
          changed = { ...changed, projectId: toKind === "project" ? newId : undefined };
        }
        return changed;
      }),
    } as AppState;
  }
  return next;
}

export const DEFAULT_MARKET_ITEMS: MarketItem[] = [
  // ── Images ──
  { id: "img1", kind: "image", prompt: "A glowing orange nebula shaped like a mechanical butterfly, unreal engine rendering", model: "img/flux-2-klein", author: "@cosmic_render", likes: 1420, likedByUser: false },
  { id: "img2", kind: "image", prompt: "Detailed cyberpunk samurai standing under neon rain, dramatic lighting, 8k resolution", model: "img/flux-2-klein", author: "@pixel_ronin", likes: 980, likedByUser: false },
  { id: "img3", kind: "image", prompt: "Magical library hidden inside a giant hollow oak tree, fantasy painting style", model: "img/seedream-4-5", author: "@spellbound", likes: 2310, likedByUser: false },
  { id: "img4", kind: "image", prompt: "A majestic crystalline white stag walking through an enchanted emerald forest", model: "img/flux-free", author: "@aurora_art", likes: 880, likedByUser: false },
  { id: "img5", kind: "image", prompt: "Retro-futuristic astronaut lounge on Mars, vaporwave aesthetic, warm shadows", model: "img/gpt-5-4-image-2", author: "@red_planet", likes: 1250, likedByUser: false },
  { id: "img6", kind: "image", prompt: "Ethereal glass palace floating above a sea of clouds during a golden sunset", model: "img/gemini-3-pro-image", author: "@stratus_design", likes: 3100, likedByUser: false },

  // ── Videos ──
  { id: "vid1", kind: "video", prompt: "Cinematic flythrough of a translucent glass skyscraper city during a meteor shower", model: "vid/sora-2", author: "@glass_lens", likes: 4500, likedByUser: false },
  { id: "vid2", kind: "video", prompt: "Macro video of tiny mechanical robots farming moss on a basalt rock, photorealistic", model: "vid/veo-3", author: "@nano_nature", likes: 2800, likedByUser: false },
  { id: "vid3", kind: "video", prompt: "A surreal cosmic black hole swallowing a glowing blue solar system, fluid dynamics, high motion", model: "vid/seedance-2", author: "@event_horizon", likes: 3400, likedByUser: false },
  { id: "vid4", kind: "video", prompt: "Slow motion close-up of clockwork gear mechanisms rotating inside a crystal sphere", model: "vid/kling-3-standard", author: "@crono_watch", likes: 1900, likedByUser: false },

  // ── Music ──
  { id: "mus1", kind: "audio", prompt: "Nocturnal synthwave with deep cello swells and retro analog drum beat", model: "aud/lyria-3-pro", author: "@retro_wave", likes: 1850, likedByUser: false },
  { id: "mus2", kind: "audio", prompt: "Minimalist piano solo transitioning into a cinematic ambient string crescendo", model: "aud/lyria-3-clip", author: "@mozart_ambient", likes: 2900, likedByUser: false },
  { id: "mus3", kind: "audio", prompt: "Glitch-hop lo-fi instrumental beat with vinyl crackles and jazz trumpet accents", model: "aud/gpt-4o-mini-tts", author: "@groove_vinyl", likes: 1100, likedByUser: false },
  { id: "mus4", kind: "audio", prompt: "Dark industrial warehouse techno loop with heavy modular synth modulation", model: "aud/gemini-3-1-flash-tts", author: "@heavy_voltage", likes: 950, likedByUser: false },

  // ── Coding / Presets ──
  { id: "cod1", kind: "coding", prompt: "Contrast/debate helper: Give a safe option, a bold alternative, and a contrarian critique", model: "pro/gpt-5-1-codex", author: "@dialectic_ai", likes: 3200, likedByUser: false },
  { id: "cod2", kind: "coding", prompt: "React 3D canvas preset: Render an interactive procedural marble shader sphere", model: "or/qwen-coder-72b", author: "@react_specular", likes: 2500, likedByUser: false },
  { id: "cod3", kind: "coding", prompt: "Fast rust game engine boilerplate: Initialize a 60fps game loop with input handling", model: "pro/claude-sonnet-5-code", author: "@rust_gear", likes: 4100, likedByUser: false },
  { id: "cod4", kind: "coding", prompt: "Automated regex compiler: Synthesize and explain complex regex search patterns", model: "elite/codestral-2508", author: "@parser_regex", likes: 1800, likedByUser: false },
];

function defaultSelected(category: Category) {
  return modelsForCategory(category).slice(0, 3).map((model) => model.id);
}

function initialState(): AppState {
  const selectedModelIds = Object.fromEntries(CATEGORIES.map(({ id }) => [id, defaultSelected(id)])) as Record<Category, string[]>;
  const activeConversationId = Object.fromEntries(CATEGORIES.map(({ id }) => [id, newConvId()])) as Record<Category, string>;
  const activeAgentId = Object.fromEntries(CATEGORIES.map(({ id }) => [id, null])) as Record<Category, string | null>;
  const incognito = Object.fromEntries(CATEGORIES.map(({ id }) => [id, false])) as Record<Category, boolean>;
  const cardPrompts = Object.fromEntries(CATEGORIES.map(({ id }) => [id, {}])) as Record<Category, Record<string, string>>;
  const chatMode = Object.fromEntries(CATEGORIES.map(({ id }) => [id, "default" as ChatMode])) as Record<Category, ChatMode>;
  const webSearch = Object.fromEntries(CATEGORIES.map(({ id }) => [id, false])) as Record<Category, boolean>;
  return {
    tier: "free", credits: TIER_INFO.free.pool,
    dailyMessagesSent: 0,
    lastMessageResetDate: new Date().toISOString().split("T")[0],
    monthlyMessagesSent: 0,
    lastMonthReset: new Date().toISOString().slice(0, 7),
    lastCreditResetDate: new Date().toISOString().split("T")[0],
    activeCategory: "general",
    selectedModelIds, activeConversationId, activeAgentId, cardPrompts, chatMode, webSearch,
    conversationProjectId: {},
    conversations: [],
    memories: [
      { id: "m_mock1", modelId: "groq/llama-3.3-70b", content: "User prefers dark HSL gradient theme backgrounds.", ts: Date.now() - 3600000 },
      { id: "m_mock2", modelId: "pro/gpt-5-1-codex", content: "Prefers concise, non-wordy replies.", ts: Date.now() - 7200000 }
    ],
    reminders: [
      { id: "r_mock1", title: "Review agreement consensus deviations", due: Date.now(), done: false, ts: Date.now(), priority: "high", progress: "inprogress", tags: ["consensus", "audit"] },
      { id: "r_mock2", title: "Deploy Pro Wallpaper live MP4 loop assets", due: Date.now() + 86400000 * 2, done: false, ts: Date.now(), priority: "med", progress: "todo", tags: ["wallpapers"] },
      { id: "r_mock3", title: "Test daily prompt quota exhaustion toast", due: Date.now() - 3600000, done: true, ts: Date.now(), priority: "low", progress: "done", tags: ["billing"] }
    ],
    projects: [
      {
        id: "p_mock1",
        name: "Neural Engine v2",
        tasks: [
          { id: "t_mock1", title: "Train Llama-3-8B weights on custom dataset", done: false, priority: "high" },
          { id: "t_mock2", title: "Integrate Audio rotating vinyl widget", done: true, priority: "med" },
          { id: "t_mock3", title: "Optimize 3D Svg specular marble shading", done: false, priority: "high" }
        ]
      },
      {
        id: "p_mock2",
        name: "Suno Arrangement",
        tasks: [
          { id: "t_mock4", title: "Compose synthwave arrangement tracks", done: false, priority: "low" }
        ]
      }
    ],
    artifacts: [],
    files: [], generations: [], consensusRuns: [],
    wallpaper: "default",
    autoGen: true, incognito,
    auth: { kind: "guest" },
    hydrated: false,
    seen: {},
    // Settings defaults
    sendOnEnter: false,
    messageDensity: "comfortable",
    autoScroll: true,
    language: "English",
    fontSize: "medium",
    // Off by default — measured at 3-row density, title+description ate
    // 25% of a card's height before any actual model output was visible.
    // Still user-togglable (Settings > Display > Show model descriptions)
    // for anyone who wants it back, just not the default anymore.
    showModelDescriptions: false,
    smartGenNotifications: true,
    globalDefaultChatMode: "default",
    autoWipeOnConsensus: false,
    autoArchiveOnNew: true,
    gridRows: 2,
    autoConsensusSummary: true,
    smartBoard: { view: "board", groupBy: "status", sortBy: "manual", filter: "", order: {}, hideDone: false, circleField: "", page: 0 },
    cardTypeFields: { ...DEFAULT_CARD_TYPE_FIELDS },
    fieldDefs: { ...DEFAULT_FIELD_DEFS },
    customAgents: [],
    customInstructions: "",
    activeSkills: [],
    marketItems: [...DEFAULT_MARKET_ITEMS, ...generateMoreMarketItems(82, DEFAULT_MARKET_ITEMS.length)],
    ownedWallpaperIds: [],
    collections: [],
    favoriteAssetIds: [],
    savedAssets: [],
    musicPlayer: { trackId: null, isPlaying: false, volume: 0.6, muted: false, disabledTrackIds: [] },
  };
}

function applySmart(state: AppState, batch: SmartBatch, modelId?: string, convId?: string): AppState {
  let next = state;
  const seen = { ...state.seen };
  const projectIdMap: Record<string, string> = {};
  let convProjectId = convId ? state.conversationProjectId[convId] : undefined;
  const recordConvProject = (pid?: string) => {
    if (convId && pid && !convProjectId) convProjectId = pid;
  };

  for (const p of batch.projects) {
    if (seen[p.fingerprint]) continue;
    seen[p.fingerprint] = true;
    // Concurrent replies from different models can each independently decide
    // "no existing project matches" and mint slightly different names for
    // the same new matter ("Smith car accident" vs "...case") — fingerprints
    // don't catch that since they hash the (different) name. A name-overlap
    // check against what's already in `next` (not just the pre-batch state)
    // does, and reuses the winner instead of forking a second project.
    const dupe = next.projects.find((existing) => overlap(tokens(p.name), tokens(existing.name)) > 0.6);
    if (dupe) { projectIdMap[p.fingerprint] = dupe.id; recordConvProject(dupe.id); continue; }
    const id = `p_${ids()}`;
    projectIdMap[p.fingerprint] = id;
    next = { ...next, projects: [{ id, name: p.name, tasks: [], fingerprint: p.fingerprint, modelId: modelId || "global" }, ...next.projects] };
    recordConvProject(id);
  }
  for (const m of batch.memories) {
    if (seen[m.fingerprint]) continue;
    seen[m.fingerprint] = true;
    if (isSemanticDuplicate(m.content, next.memories.map((x) => x.content))) continue;
    const projectId = m.projectId?.startsWith("virt_") ? projectIdMap[m.projectId.slice(5)] : m.projectId;
    next = { ...next, memories: [{ id: `m_${ids()}`, modelId: modelId || "global", content: m.content, ts: Date.now(), tags: m.tags, projectId, priority: m.priority || "none", fingerprint: m.fingerprint }, ...next.memories] };
    recordConvProject(projectId);
  }
  for (const r of batch.reminders) {
    if (seen[r.fingerprint]) continue;
    seen[r.fingerprint] = true;
    if (isSemanticDuplicate(r.title, next.reminders.map((x) => x.title))) continue;
    const projectId = r.projectId?.startsWith("virt_") ? projectIdMap[r.projectId.slice(5)] : r.projectId;
    if (r.isTask && projectId) {
      next = { ...next, projects: next.projects.map((p) => p.id === projectId ? { ...p, tasks: [{ id: `t_${ids()}`, title: r.title, done: false, priority: r.priority || "none" }, ...p.tasks] } : p) };
    } else {
      next = { ...next, reminders: [{ id: `r_${ids()}`, title: r.title, due: r.due, done: false, ts: Date.now(), priority: r.priority || "none", projectId, progress: r.progress, tags: r.tags, fingerprint: r.fingerprint, isTask: r.isTask, modelId: modelId || "global", calendarTitle: "Personal Calendar" }, ...next.reminders] };
    }
    recordConvProject(projectId);
  }
  if (convId && convProjectId && convProjectId !== state.conversationProjectId[convId]) {
    next = { ...next, conversationProjectId: { ...next.conversationProjectId, [convId]: convProjectId } };
  }
  return { ...next, seen };
}

// Applies the additive LLM-based extraction batch (see src/services/llmExtract.ts).
// Same dedup-by-fingerprint / virtual-project shape as applySmart above, plus
// Artifact creation. Dispatched via "applySmartBatch" once the background
// smartGenLLM() promise resolves — see the AppProvider effect below.
function applyLLMBatch(state: AppState, batch: LLMBatch, modelId?: string, convId?: string): AppState {
  let next = state;
  const seen = { ...state.seen };
  const projectIdMap: Record<string, string> = {};
  let convProjectId = convId ? state.conversationProjectId[convId] : undefined;
  const recordConvProject = (pid?: string) => {
    if (convId && pid && !convProjectId) convProjectId = pid;
  };

  for (const p of batch.projects) {
    if (seen[p.fingerprint]) continue;
    seen[p.fingerprint] = true;
    // Same race as applySmart: concurrent per-model replies about the same
    // brand-new matter can each mint a slightly different name for it before
    // any of their dispatches land — catch that by name-overlap, not just
    // fingerprint, and reuse whichever one landed first instead of forking.
    const dupe = next.projects.find((existing) => overlap(tokens(p.name), tokens(existing.name)) > 0.6);
    if (dupe) { projectIdMap[p.fingerprint] = dupe.id; recordConvProject(dupe.id); continue; }
    const id = `p_${ids()}`;
    projectIdMap[p.fingerprint] = id;
    next = { ...next, projects: [{ id, name: p.name, tasks: [], fingerprint: p.fingerprint, modelId: modelId || "global" }, ...next.projects] };
    recordConvProject(id);
  }
  const resolveProjectId = (pid?: string) => (pid?.startsWith("virt_") ? projectIdMap[pid.slice(5)] : pid);

  for (const m of batch.memories) {
    if (seen[m.fingerprint]) continue;
    seen[m.fingerprint] = true;
    if (isSemanticDuplicate(m.content, next.memories.map((x) => x.content))) continue;
    const projectId = resolveProjectId(m.projectId);
    next = { ...next, memories: [{ id: `m_${ids()}`, modelId: modelId || "global", content: m.content, ts: Date.now(), tags: m.tags, projectId, priority: m.priority || "none", fingerprint: m.fingerprint }, ...next.memories] };
    recordConvProject(projectId);
  }
  for (const r of batch.reminders) {
    if (seen[r.fingerprint]) continue;
    seen[r.fingerprint] = true;
    if (isSemanticDuplicate(r.title, next.reminders.map((x) => x.title))) continue;
    const projectId = resolveProjectId(r.projectId);
    if (r.isTask && projectId) {
      next = { ...next, projects: next.projects.map((p) => p.id === projectId ? { ...p, tasks: [{ id: `t_${ids()}`, title: r.title, done: false, priority: r.priority || "none" }, ...p.tasks] } : p) };
    } else {
      next = { ...next, reminders: [{ id: `r_${ids()}`, title: r.title, due: r.due, done: false, ts: Date.now(), priority: r.priority || "none", projectId, progress: r.progress, tags: r.tags, fingerprint: r.fingerprint, isTask: r.isTask, modelId: modelId || "global", calendarTitle: "Personal Calendar" }, ...next.reminders] };
    }
    recordConvProject(projectId);
  }
  for (const a of batch.artifacts) {
    if (seen[a.fingerprint]) continue;
    seen[a.fingerprint] = true;
    if (isSemanticDuplicate(a.title, next.artifacts.map((x) => x.title))) continue;
    const projectId = resolveProjectId(a.projectId);
    next = { ...next, artifacts: [{ id: `art_${ids()}`, title: a.title, content: a.content, kind: a.kind, modelId: modelId || "global", projectId, ts: Date.now(), fingerprint: a.fingerprint }, ...next.artifacts] };
    recordConvProject(projectId);
  }
  if (convId && convProjectId && convProjectId !== state.conversationProjectId[convId]) {
    next = { ...next, conversationProjectId: { ...next.conversationProjectId, [convId]: convProjectId } };
  }
  return { ...next, seen };
}

// Completing a recurring reminder finishes this occurrence and rolls the
// card to the next one — the reminder itself never "dies" while it repeats.
// The next due is advanced past now (catching up across missed intervals),
// progress resets, and the Google-event linkage is cleared so the auto-sync
// effect books the new occurrence as its own calendar event.
function advanceDue(due: number, recurring: NonNullable<Reminder["recurring"]>, now = Date.now()): number {
  const d = new Date(due);
  do {
    if (recurring === "daily") d.setDate(d.getDate() + 1);
    else if (recurring === "weekly") d.setDate(d.getDate() + 7);
    else if (recurring === "monthly") d.setMonth(d.getMonth() + 1);
    else if (recurring === "weekdays") { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
    else if (recurring === "weekends") { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 0 && d.getDay() !== 6); }
    else d.setFullYear(d.getFullYear() + 1);
  } while (d.getTime() <= now);
  return d.getTime();
}
function completeReminder(r: Reminder): Reminder {
  if (r.recurring && r.due) {
    return { ...r, due: advanceDue(r.due, r.recurring), done: false, progress: "todo", googleEventId: undefined, googleTaskId: undefined };
  }
  return { ...r, done: true, progress: "done" };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate": {
      const base = initialState();
      return { ...base, ...action.state, cardPrompts: { ...base.cardPrompts, ...(action.state.cardPrompts || {}) }, chatMode: { ...base.chatMode, ...(action.state.chatMode || {}) }, webSearch: { ...base.webSearch, ...(action.state.webSearch || {}) }, smartBoard: { ...base.smartBoard, ...(action.state.smartBoard || {}) }, cardTypeFields: { ...base.cardTypeFields, ...(action.state.cardTypeFields || {}) }, fieldDefs: { ...base.fieldDefs, ...(action.state.fieldDefs || {}) }, seen: { ...(action.state.seen || {}) }, hydrated: true };
    }
    case "category": return { ...state, activeCategory: action.category };
    case "tier": return { ...state, tier: action.tier, credits: Math.max(state.credits, TIER_INFO[action.tier].pool) };
    case "spend": {
      // General chat is always free for every tier — no credit spend, ever.
      if (state.activeCategory === "general") {
        return state;
      }
      // Pro/elite credits are a *daily* allowance for image/video/music/coding
      // models — refill to the tier pool on date rollover before spending.
      const today = new Date().toISOString().split("T")[0];
      const base = state.lastCreditResetDate !== today
        ? { ...state, credits: TIER_INFO[state.tier].pool, lastCreditResetDate: today }
        : state;
      return base.credits < action.credits ? base : { ...base, credits: base.credits - action.credits };
    }
    case "refund": {
      // Capped at the tier's pool so a refund can never inflate the balance
      // above a legitimate day's allowance (e.g. a failure arriving after a
      // rollover already refilled).
      const pool = TIER_INFO[state.tier].pool;
      return { ...state, credits: Math.min(pool, state.credits + action.credits) };
    }
    case "toggleModel": {
      const current = state.selectedModelIds[action.category];
      const next = current.includes(action.modelId) ? current.filter((id) => id !== action.modelId) : [...current, action.modelId];
      return { ...state, selectedModelIds: { ...state.selectedModelIds, [action.category]: next } };
    }
    case "newConversation": {
      const oldId = state.activeConversationId[action.category];
      return {
        ...state,
        activeConversationId: { ...state.activeConversationId, [action.category]: newConvId() },
        cardPrompts: { ...state.cardPrompts, [action.category]: {} },
        conversations: state.conversations.map((c) => c.id === oldId ? { ...c, archived: true } : c),
        chatMode: { ...state.chatMode, [action.category]: state.globalDefaultChatMode },
      };
    }
    case "loadConversation": return { ...state, activeCategory: action.category, activeConversationId: { ...state.activeConversationId, [action.category]: action.id } };

    case "cardPrompt": return { ...state, cardPrompts: { ...state.cardPrompts, [action.category]: { ...state.cardPrompts[action.category], [action.modelId]: action.value } } };
    case "chatMode": return { ...state, chatMode: { ...state.chatMode, [action.category]: action.mode } };
    case "webSearch": return { ...state, webSearch: { ...state.webSearch, [action.category]: action.enabled } };
    case "append": {
      const convId = action.convId || state.activeConversationId[action.category];
      const existing = state.conversations.find((conv) => conv.id === convId);
      if (!existing) {
        const title = action.message.role === "user" ? action.message.content.slice(0, 44) : "New chat";
        const conv: Conversation = { id: convId, title, tab: action.category, createdAt: Date.now(), threads: { [action.modelId]: [action.message] } };
        return { ...state, conversations: [conv, ...state.conversations] };
      }
      const threads = { ...existing.threads, [action.modelId]: [...(existing.threads[action.modelId] || []), action.message] };
      const updated = { ...existing, threads, title: existing.title === "New chat" && action.message.role === "user" ? action.message.content.slice(0, 44) : existing.title };
      return { ...state, conversations: state.conversations.map((conv) => conv.id === convId ? updated : conv) };
    }
    case "replaceLastAssistant": {
      const convId = action.convId || state.activeConversationId[action.category];
      const existing = state.conversations.find((conv) => conv.id === convId);
      const thread = existing?.threads[action.modelId] || [];
      if (!existing || !thread.length) return state;
      const nextThread = [...thread];
      nextThread[nextThread.length - 1] = { ...nextThread[nextThread.length - 1], content: action.content, streaming: !!action.streaming };
      const updated = { ...existing, threads: { ...existing.threads, [action.modelId]: nextThread } };
      let s = { ...state, conversations: state.conversations.map((conv) => conv.id === convId ? updated : conv) };
      // Smart Gen only ever runs on what the USER typed (via smartCaptureText
      // at submit time) — never on the assistant's own reply. Memory exists
      // to remember things about the user ("Remember that the user
      // prefers..."), and running the same heuristic on the AI's explanatory
      // text was capturing generic facts the model stated (e.g. "larger
      // models have more capacity to learn") as if they were user
      // preferences worth remembering. That's not what this feature is for.
      return s;
    }
    case "deleteMessage": {
      const convId = action.convId || state.activeConversationId[action.category];
      const existing = state.conversations.find((c) => c.id === convId);
      if (!existing) return state;
      const nextThread = (existing.threads[action.modelId] || []).filter((m) => m.id !== action.messageId);
      const updated = { ...existing, threads: { ...existing.threads, [action.modelId]: nextThread } };
      return { ...state, conversations: state.conversations.map((c) => c.id === convId ? updated : c) };
    }
    case "smartCapture": {
      if (!state.autoGen) return state;
      const batch = smartGen(action.text, { projects: state.projects, memories: state.memories, reminders: state.reminders, seen: state.seen });
      return applySmart(state, batch, action.modelId, action.convId);
    }
    case "memory": {
      const fp = action.fingerprint || `manual::${action.content.toLowerCase().slice(0, 40)}`;
      if (state.seen[fp]) return state;
      const newId = action.id || `m_${ids()}`;
      let next: AppState = { ...state, seen: { ...state.seen, [fp]: true }, memories: [{ id: newId, modelId: action.modelId || state.selectedModelIds[state.activeCategory]?.[0] || "global", content: action.content, ts: Date.now(), tags: action.tags, projectId: action.projectId, priority: action.priority || "none", fingerprint: fp }, ...state.memories] };
      if (action.linkFrom) next = linkItems(next, action.linkFrom, { kind: "memory", id: newId });
      return next;
    }
    case "removeMemory": return { ...state, memories: state.memories.filter((m) => m.id !== action.id) };
    case "removeMemories": { const ids2 = new Set(action.ids); return { ...state, memories: state.memories.filter((m) => !ids2.has(m.id)) }; }
    case "updateMemory": return { ...state, memories: state.memories.map((m) => m.id === action.memory.id ? action.memory : m) };
    case "reminder": {
      const fp = action.fingerprint || `manual::${action.title.toLowerCase().slice(0, 40)}::${action.due ? Math.floor(action.due / 86400000) : ""}`;
      if (state.seen[fp]) return state;
      const newId = action.id || `r_${ids()}`;
      let next: AppState = { ...state, seen: { ...state.seen, [fp]: true }, reminders: [{ id: newId, title: action.title, due: action.due, done: false, ts: Date.now(), priority: action.priority || "none", projectId: action.projectId, progress: action.progress || "todo", tags: action.tags, fingerprint: fp, isTask: action.isTask, modelId: action.modelId || state.selectedModelIds[state.activeCategory]?.[0] || "global", calendarId: action.calendarId, calendarTitle: action.calendarTitle || "Personal Calendar", time: action.time, date: action.date, recurring: action.recurring }, ...state.reminders] };
      if (action.linkFrom) next = linkItems(next, action.linkFrom, { kind: "reminder", id: newId });
      return next;
    }
    case "toggleReminder": return { ...state, reminders: state.reminders.map((r) => r.id === action.id ? (!r.done ? completeReminder(r) : { ...r, done: false, progress: "todo" }) : r) };
    case "cycleReminderProgress": {
      const order: Progress[] = ["todo", "inprogress", "done"];
      return { ...state, reminders: state.reminders.map((r) => {
        if (r.id !== action.id) return r;
        const cur = r.progress || "todo";
        const next = order[(order.indexOf(cur) + 1) % order.length];
        if (next === "done") return completeReminder(r);
        return { ...r, progress: next, done: false };
      }) };
    }
    case "removeReminder": return { ...state, reminders: state.reminders.filter((r) => r.id !== action.id) };
    case "removeReminders": { const ids2 = new Set(action.ids); return { ...state, reminders: state.reminders.filter((r) => !ids2.has(r.id)) }; }
    case "project": {
      const fp = action.fingerprint || `manual::proj::${action.name.toLowerCase()}`;
      if (state.seen[fp]) return state;
      const newId = action.id || `p_${ids()}`;
      let next: AppState = { ...state, seen: { ...state.seen, [fp]: true }, projects: [{ id: newId, name: action.name, tasks: [], fingerprint: fp, modelId: action.modelId || state.selectedModelIds[state.activeCategory]?.[0] || "global" }, ...state.projects] };
      if (action.linkFrom) next = linkItems(next, action.linkFrom, { kind: "project", id: newId });
      return next;
    }
    case "removeProject": return { ...state, projects: state.projects.filter((p) => p.id !== action.id) };
    case "removeProjects": { const ids2 = new Set(action.ids); return { ...state, projects: state.projects.filter((p) => !ids2.has(p.id)) }; }
    case "updateProject": return { ...state, projects: state.projects.map((p) => p.id === action.project.id ? action.project : p) };
    case "artifact": {
      const fp = action.fingerprint || `manual::artifact::${action.title.toLowerCase().slice(0, 40)}`;
      if (state.seen[fp]) return state;
      const newId = action.id || `art_${ids()}`;
      let next: AppState = {
        ...state,
        seen: { ...state.seen, [fp]: true },
        artifacts: [{
          id: newId,
          title: action.title,
          content: action.content,
          kind: action.kind,
          modelId: action.modelId || state.selectedModelIds[state.activeCategory]?.[0] || "global",
          projectId: action.projectId,
          ts: Date.now(),
          fingerprint: fp,
          customFields: action.customFields,
        }, ...state.artifacts],
      };
      if (action.linkFrom) next = linkItems(next, action.linkFrom, { kind: "artifact", id: newId });
      return next;
    }
    case "removeArtifact": return { ...state, artifacts: state.artifacts.filter((a) => a.id !== action.id) };
    case "removeArtifacts": { const ids2 = new Set(action.ids); return { ...state, artifacts: state.artifacts.filter((a) => !ids2.has(a.id)) }; }
    case "updateArtifact": return { ...state, artifacts: state.artifacts.map((a) => a.id === action.artifact.id ? action.artifact : a) };
    case "linkItems": return linkItems(state, action.a, action.b);
    case "unlinkItems": return unlinkItems(state, action.a, action.b);
    case "embedCard": {
      // A card can't embed itself, and a direct two-card cycle (A in B while
      // B is in A) would render forever — refuse both, allow everything else.
      if (action.host.kind === action.card.kind && action.host.id === action.card.id) return state;
      const target = findCard(state, action.card);
      if ((target as any)?.embeds?.some((e: CardEmbed) => e.kind === action.host.kind && e.id === action.host.id)) return state;
      return mutateCard(state, action.host, (item) => {
        const embeds: CardEmbed[] = item.embeds || [];
        if (embeds.some((e) => e.kind === action.card.kind && e.id === action.card.id)) return item;
        return { ...item, embeds: [...embeds, action.card] };
      });
    }
    case "unembedCard":
      return mutateCard(state, action.host, (item) => ({
        ...item,
        embeds: (item.embeds || []).filter((e: CardEmbed) => !(e.kind === action.card.kind && e.id === action.card.id)),
      }));
    case "setCardFields":
      return mutateCard(state, action.ref, (item) => ({ ...item, customFields: action.fields }));
    case "setTypeFields":
      return { ...state, cardTypeFields: { ...state.cardTypeFields, [action.kind]: action.fields } };
    case "defineField": {
      const name = action.def.name.trim();
      if (!name) return state;
      let next: AppState = { ...state, fieldDefs: { ...state.fieldDefs, [name]: { ...action.def, name } } };
      for (const k of action.cardTypes || []) {
        const list = next.cardTypeFields[k] || [];
        if (!list.includes(name)) next = { ...next, cardTypeFields: { ...next.cardTypeFields, [k]: [...list, name] } };
      }
      return next;
    }
    case "removeFieldDef": {
      const defs = { ...state.fieldDefs };
      delete defs[action.name];
      const cardTypeFields = Object.fromEntries(
        Object.entries(state.cardTypeFields).map(([k, list]) => [k, list.filter((f) => f !== action.name)])
      ) as CardTypeFields;
      return { ...state, fieldDefs: defs, cardTypeFields };
    }
    case "setBoardConfig":
      return { ...state, smartBoard: { ...state.smartBoard, ...action.config } };
    case "reorderCards": {
      const order = { ...state.smartBoard.order };
      action.keys.forEach((k, i) => { order[k] = i; });
      // A drag is a decision; it must not be silently undone by an active
      // sort, so placing a card also returns the board to manual order.
      return { ...state, smartBoard: { ...state.smartBoard, order, sortBy: "manual" } };
    }
    case "convertCard":
      return convertCardInState(state, action.ref, action.toKind);
    case "applySmartBatch": return applyLLMBatch(state, action.batch, action.modelId, action.convId);
    case "task": return { ...state, projects: state.projects.map((p) => p.id === action.projectId ? { ...p, tasks: [...p.tasks, { id: `t_${ids()}`, title: action.title, done: false, priority: action.priority || "none" }] } : p) };
    case "toggleTask": return { ...state, projects: state.projects.map((p) => p.id === action.projectId ? { ...p, tasks: p.tasks.map((t) => t.id === action.taskId ? { ...t, done: !t.done } : t) } : p) };
    case "updateTask": return { ...state, projects: state.projects.map((p) => p.id === action.projectId ? { ...p, tasks: p.tasks.map((t) => t.id === action.task.id ? action.task : t) } : p) };
    case "removeTask": return { ...state, projects: state.projects.map((p) => p.id === action.projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== action.taskId) } : p) };
    case "updateReminder": return { ...state, reminders: state.reminders.map((r) => r.id === action.reminder.id ? action.reminder : r) };
    case "file": return { ...state, files: [{ id: `f_${ids()}`, ts: Date.now(), modelId: action.file.modelId || state.selectedModelIds[state.activeCategory]?.[0] || "global", ...action.file }, ...state.files] };
    case "removeFile": return { ...state, files: state.files.filter((f) => f.id !== action.id) };
    case "removeFiles": { const ids2 = new Set(action.ids); return { ...state, files: state.files.filter((f) => !ids2.has(f.id)) }; }
    case "updateFile": return { ...state, files: state.files.map((f) => f.id === action.file.id ? action.file : f) };
    case "addGeneration": return { ...state, generations: [{ id: `g_${ids()}`, ts: Date.now(), ...action.generation }, ...state.generations] };
    case "removeGeneration": return { ...state, generations: state.generations.filter((g) => g.id !== action.id) };
    case "removeGenerations": { const ids2 = new Set(action.ids); return { ...state, generations: state.generations.filter((g) => !ids2.has(g.id)) }; }
    case "consensus": return { ...state, consensusRuns: [{ id: `cr_${ids()}`, ts: Date.now(), ...action.run }, ...state.consensusRuns] };
    case "removeConsensus": return { ...state, consensusRuns: state.consensusRuns.filter((r) => r.id !== action.id) };
    case "removeConsensuses": { const ids2 = new Set(action.ids); return { ...state, consensusRuns: state.consensusRuns.filter((r) => !ids2.has(r.id)) }; }
    case "removeConversations": { const ids2 = new Set(action.ids); return { ...state, conversations: state.conversations.filter((c) => !ids2.has(c.id)) }; }
    case "wallpaper": return { ...state, wallpaper: action.wallpaper };
    // Mocked purchase — adds to owned list locally, no real billing wired
    // in. See WallpapersScreen.tsx for the note on why (real IAP needs
    // explicit sign-off before it touches actual money).
    case "toggleFavoriteAsset": {
      const on = state.favoriteAssetIds.includes(action.asset.id);
      // Favoriting also files the asset into the implicit "Favorites"
      // collection so there is exactly one place assets live. Without this a
      // favorited item has a flag but no record, and disappears from the feed
      // it was favorited in — which is the bug this whole feature exists to
      // fix.
      const favs = on
        ? state.favoriteAssetIds.filter((i) => i !== action.asset.id)
        : [...state.favoriteAssetIds, action.asset.id];
      return { ...state, favoriteAssetIds: favs, savedAssets: upsertAsset(state, action.asset) };
    }
    case "createCollection": {
      const col: SavedCollection = {
        id: `col_${Date.now()}`,
        name: action.name.trim() || "Untitled collection",
        assetIds: action.asset ? [action.asset.id] : [],
        createdAt: Date.now(),
      };
      return {
        ...state,
        collections: [col, ...state.collections],
        savedAssets: action.asset ? upsertAsset(state, action.asset) : state.savedAssets,
      };
    }
    case "saveToCollection": {
      return {
        ...state,
        savedAssets: upsertAsset(state, action.asset),
        collections: state.collections.map((c) =>
          c.id === action.collectionId && !c.assetIds.includes(action.asset.id)
            ? { ...c, assetIds: [action.asset.id, ...c.assetIds] }
            : c
        ),
      };
    }
    case "removeFromCollection":
      return {
        ...state,
        collections: state.collections.map((c) =>
          c.id === action.collectionId ? { ...c, assetIds: c.assetIds.filter((i) => i !== action.assetId) } : c
        ),
      };
    case "deleteCollection":
      return { ...state, collections: state.collections.filter((c) => c.id !== action.collectionId) };
    case "purchaseWallpaper":
      return state.ownedWallpaperIds.includes(action.wallpaperId)
        ? state
        : { ...state, ownedWallpaperIds: [...state.ownedWallpaperIds, action.wallpaperId] };
    case "playTrack": return { ...state, musicPlayer: { ...state.musicPlayer, trackId: action.trackId, isPlaying: true } };
    case "pausePlayer": return { ...state, musicPlayer: { ...state.musicPlayer, isPlaying: false } };
    case "resumePlayer": return { ...state, musicPlayer: { ...state.musicPlayer, isPlaying: !!state.musicPlayer.trackId } };
    case "setPlayerVolume": return { ...state, musicPlayer: { ...state.musicPlayer, volume: Math.max(0, Math.min(1, action.volume)), muted: false } };
    case "togglePlayerMute": return { ...state, musicPlayer: { ...state.musicPlayer, muted: !state.musicPlayer.muted } };
    case "toggleTrackEnabled": {
      const disabled = state.musicPlayer.disabledTrackIds.includes(action.trackId)
        ? state.musicPlayer.disabledTrackIds.filter((id) => id !== action.trackId)
        : [...state.musicPlayer.disabledTrackIds, action.trackId];
      return { ...state, musicPlayer: { ...state.musicPlayer, disabledTrackIds: disabled } };
    }
    case "autoGen": return { ...state, autoGen: action.enabled };
    case "incognito": return { ...state, incognito: { ...state.incognito, [action.category]: action.enabled } };
    case "auth": return { ...state, auth: action.user };
    case "recordMessageSent": {
      const today = new Date().toISOString().split("T")[0];
      const thisMonth = new Date().toISOString().slice(0, 7);
      const dailyReset = state.lastMessageResetDate !== today;
      const monthlyReset = state.lastMonthReset !== thisMonth;
      return {
        ...state,
        dailyMessagesSent: dailyReset ? 1 : state.dailyMessagesSent + 1,
        lastMessageResetDate: today,
        monthlyMessagesSent: monthlyReset ? 1 : state.monthlyMessagesSent + 1,
        lastMonthReset: thisMonth,
      };
    }
    case "resetLimits": {
      const today = new Date().toISOString().split("T")[0];
      const thisMonth = new Date().toISOString().slice(0, 7);
      return {
        ...state,
        dailyMessagesSent: 0,
        monthlyMessagesSent: 0,
        lastMessageResetDate: today,
        lastMonthReset: thisMonth,
        credits: TIER_INFO[state.tier].pool,
        lastCreditResetDate: today,
      };
    }
    case "setSendOnEnter": return { ...state, sendOnEnter: action.value };
    case "setMessageDensity": return { ...state, messageDensity: action.value };
    case "setAutoScroll": return { ...state, autoScroll: action.value };
    case "setLanguage": return { ...state, language: action.value };
    case "setFontSize": return { ...state, fontSize: action.value };
    case "setShowModelDescriptions": return { ...state, showModelDescriptions: action.value };
    case "setSmartGenNotifications": return { ...state, smartGenNotifications: action.value };
    case "setGlobalDefaultChatMode": return { ...state, globalDefaultChatMode: action.value };
    case "setAutoWipeOnConsensus": return { ...state, autoWipeOnConsensus: action.value };
    case "setAutoArchiveOnNew": return { ...state, autoArchiveOnNew: action.value };
    case "setGridRows": return { ...state, gridRows: action.value };
    case "setAutoConsensusSummary": return { ...state, autoConsensusSummary: action.value };
    case "addCustomAgent": return { ...state, customAgents: [...state.customAgents, { id: `ag_${ids()}`, ...action.agent }] };
    case "updateCustomAgent": return { ...state, customAgents: state.customAgents.map((a) => a.id === action.agent.id ? action.agent : a) };
    case "removeCustomAgent": {
      // Deactivate this agent everywhere it's currently in use — an active
      // agent that no longer exists would otherwise silently keep injecting
      // instructions for a persona the user just deleted.
      const activeAgentId = Object.fromEntries(
        Object.entries(state.activeAgentId).map(([cat, id]) => [cat, id === action.id ? null : id])
      ) as Record<Category, string | null>;
      return { ...state, customAgents: state.customAgents.filter((a) => a.id !== action.id), activeAgentId };
    }
    case "setActiveAgent": return { ...state, activeAgentId: { ...state.activeAgentId, [action.category]: action.agentId } };
    case "setCustomInstructions": return { ...state, customInstructions: action.value };
    case "toggleSkill": return { ...state, activeSkills: state.activeSkills.includes(action.skillId) ? state.activeSkills.filter(s => s !== action.skillId) : [...state.activeSkills, action.skillId] };
    case "publishToMarket": {
      const id = `pub_${ids()}`;
      const newItem: MarketItem = {
        id,
        ...action.item,
        likes: 0,
        likedByUser: false,
      };
      return { ...state, marketItems: [newItem, ...state.marketItems] };
    }
    case "loadMoreMarket": {
      const generated = generateMoreMarketItems(action.count, state.marketItems.length);
      return { ...state, marketItems: [...state.marketItems, ...generated] };
    }
    case "toggleMarketLike": {
      return {
        ...state,
        marketItems: state.marketItems.map((item) => {
          if (item.id === action.id) {
            const liked = !item.likedByUser;
            return {
              ...item,
              likedByUser: liked,
              likes: item.likes + (liked ? 1 : -1),
            };
          }
          return item;
        }),
      };
    }
    default: return state;
  }
}

const STORAGE_KEY = "collider-state-v4";

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action>; getState: () => AppState } | undefined>(undefined);

export function AppProvider({ children }: { children?: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) dispatch({ type: "hydrate", state: JSON.parse(raw) });
        else dispatch({ type: "hydrate", state: {} });
      } catch { dispatch({ type: "hydrate", state: {} }); }
    })();
  }, []);
  useEffect(() => {
    if (!state.hydrated) return;
    const { hydrated, ...persisted } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => {});
  }, [state]);

  // Deep-integration follow-through: a high-priority reminder is, by
  // definition, something with real consequences if missed — it shouldn't
  // sit there waiting for the user to notice it and press a manual "sync"
  // button. If Google Calendar is already connected, push it the moment it
  // appears. attemptedRef guards against re-sending on every render and
  // against hammering the token endpoint when Google isn't connected at all
  // (one attempt per reminder id per app session either way).
  const attemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!state.hydrated) return;
    const candidates = state.reminders.filter(
      (r) => r.priority === "high" && r.due && !r.googleEventId && !attemptedRef.current.has(r.id)
    );
    if (!candidates.length) return;
    candidates.forEach((r) => attemptedRef.current.add(r.id));
    (async () => {
      const token = await getValidAccessToken();
      if (!token) return; // Not connected — user can still sync manually from Reminders.
      for (const r of candidates) {
        try {
          const start = new Date(r.due!);
          const end = new Date(r.due! + 60 * 60 * 1000);
          const event = await createCalendarEvent(token, { title: r.title, start, end });
          dispatch({ type: "updateReminder", reminder: { ...r, googleEventId: event.id } });
        } catch {
          // Best-effort — leave it for manual sync from the Reminders screen.
        }
      }
    })();
  }, [state.hydrated, state.reminders]);

  const value = useMemo(() => ({ state, dispatch, getState: () => state }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useCollider() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useCollider must be used inside AppProvider");
  return ctx;
}

// Free tier limits — derived from competitor research (ChatGPT/Claude/Gemini Free ~15-40 msgs/5h window)
// Fixed exactly 20 messages daily (no scaling with models selected).
// General tab is ALWAYS excluded from these limits per spec.
export const FREE_DAILY_LIMIT = 20;
export const FREE_MONTHLY_LIMIT = 600;

// Free tier: 20 msgs/day, general free-models only (image/video/music/coding
// models are all tier:"pro"/"elite" — canUse() already locks those out for free
// users, so this only ever needs to gate the general tab).
// Pro/elite: unlimited general chat always, no message cap in any category.
export function isMessageLimitReached(state: AppState) {
  if (state.tier !== "free") return false;
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const dailyCount = state.lastMessageResetDate === today ? state.dailyMessagesSent : 0;
  const monthlyCount = state.lastMonthReset === thisMonth ? state.monthlyMessagesSent : 0;
  return dailyCount >= FREE_DAILY_LIMIT || monthlyCount >= FREE_MONTHLY_LIMIT;
}

// Legacy shims kept so any lingering imports don't break; new callers use smartCapture.
export function extractMemoryCandidates(text: string): string[] {
  return smartGen(text, { projects: [], memories: [], reminders: [], seen: {} }).memories.map((m) => m.content);
}
export function extractReminderCandidates(text: string): { title: string; due?: number }[] {
  return smartGen(text, { projects: [], memories: [], reminders: [], seen: {} }).reminders.map((r) => ({ title: r.title, due: r.due }));
}

const AUTHORS = ["@cyber_artist", "@pixel_wizard", "@synth_wave", "@prompt_guru", "@neural_dreamer", "@deep_coder", "@wave_maker", "@ai_visionary", "@digital_sculptor", "@sonic_architect", "@glass_lens", "@nano_nature", "@event_horizon", "@crono_watch", "@retro_wave", "@mozart_ambient", "@groove_vinyl", "@heavy_voltage", "@dialectic_ai", "@react_specular", "@rust_gear", "@parser_regex", "@stratus_design", "@aurora_art", "@red_planet", "@spellbound"];
const MODELS_POOL = ["llama-3.3-70b", "llama-3.1-8b", "gemini-flash", "mixtral-8x7b", "qwen-2.5-coder", "mistral-large", "flux-schnell", "sdxl", "sora-2", "veo-3", "luma-dream", "kling-ai", "udio", "suno"];

// Real, verified-live sample files — reused across generated items instead
// of a single repeated URL, so scrolling deep into Discover doesn't expose
// the same video/track over and over. Same domains already used by the
// curated seed data (mixkit, soundhelix), just more of them.
const VIDEO_POOL = [
  "https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-futuristic-tunnel-with-neon-lights-42292-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-digital-circuit-board-background-42289-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-rotating-planet-earth-in-outer-space-42358-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-clockwork-clock-gears-moving-macro-32752-large.mp4",
];
const MUSIC_POOL = Array.from({ length: 10 }, (_, i) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${i + 1}.mp3`);

// Each entry is a (kind, category) pair — "category" is what "more like
// this" groups on. More categories = the feed doesn't visibly loop as fast,
// and a detail view can pull a plausible "similar" set without any real
// similarity search.
const CREATION_TEMPLATES = [
  {
    kind: "image" as const, category: "cyberpunk",
    prompts: [
      "Cyberpunk street filled with neon lights, raining, reflections",
      "Cyberpunk samurai standing under neon rain, dramatic lighting, 8k",
      "Neon-drenched alley market with holographic street vendors",
      "Rain-soaked megacity rooftop chase, neon signage bleeding into fog",
    ],
  },
  {
    kind: "image" as const, category: "surreal-nature",
    prompts: [
      "Surreal floating islands with waterfalls, photorealistic",
      "Vibrant mystical forest with glowing mushrooms and deer",
      "Crystalline white stag walking through an enchanted emerald forest",
      "Bioluminescent coral reef city built into a sunken canyon",
    ],
  },
  {
    kind: "image" as const, category: "architecture",
    prompts: [
      "Minimalist organic architecture in the middle of a desert, architectural digest style",
      "An oil painting of a futuristic library with glass domes",
      "Ethereal glass palace floating above a sea of clouds during a golden sunset",
      "Futuristic metropolis with towering glass skyscrapers and highways",
    ],
  },
  {
    kind: "image" as const, category: "retro-future",
    prompts: [
      "Astronaut riding a horse on Mars, cinematic lighting, 8k",
      "Steampunk airship soaring through fluffy clouds at sunset",
      "Retro-futuristic astronaut lounge on Mars, vaporwave aesthetic, warm shadows",
      "Chrome-plated 1960s vision of a Martian colony, matte painting style",
    ],
  },
  {
    kind: "video" as const, category: "space",
    prompts: [
      "Cinematic slow motion of a futuristic spaceship entering hyperspace",
      "Epic drone shot of ancient ruins overgrown with digital vines",
      "Rotating planet earth in outer space, slow orbital pass",
      "Surreal cosmic black hole swallowing a glowing solar system, fluid dynamics",
    ],
  },
  {
    kind: "video" as const, category: "macro-tech",
    prompts: [
      "Cybernetic jellyfish swimming in a digital ocean",
      "A glowing mechanical phoenix rising from digital ash",
      "Macro video of tiny mechanical robots farming moss on a basalt rock",
      "Clockwork gear mechanisms rotating inside a crystal sphere, slow motion close-up",
    ],
  },
  {
    kind: "video" as const, category: "city-night",
    prompts: [
      "Time-lapse of a neon city night sky with flying cars",
      "Liquid gold morphing into human forms, high frame rate",
      "Cyberpunk hacker coding with holographic screens floating around",
      "Flythrough of a translucent glass skyscraper city during a meteor shower",
    ],
  },
  {
    kind: "audio" as const, category: "chill",
    prompts: [
      "Lofi chill hop beats for studying, smooth saxophone",
      "Ambient atmospheric soundscape for deep meditation",
      "Minimalist piano solo transitioning into a cinematic ambient string crescendo",
      "Glitch-hop lo-fi instrumental beat with vinyl crackles and jazz trumpet accents",
    ],
  },
  {
    kind: "audio" as const, category: "electronic",
    prompts: [
      "Synthwave cyberpunk track with heavy bassline",
      "Nocturnal synthwave with deep cello swells and retro analog drum beat",
      "Dark industrial warehouse techno loop with heavy modular synth modulation",
      "Retro 8-bit arcade soundtrack for synth platformer",
    ],
  },
  {
    kind: "audio" as const, category: "orchestral",
    prompts: [
      "Upbeat futuristic jazz fusion with electronic synth accents",
      "Epic orchestral theme with digital glitch sound design",
      "Sweeping cinematic trailer score with choir and taiko drums",
      "Melancholic string quartet reinterpreting an 8-bit game theme",
    ],
  },
  {
    kind: "coding" as const, category: "systems",
    prompts: [
      "Rust game engine boilerplate with WebGL rendering pipeline",
      "Fast rust game engine boilerplate: 60fps game loop with input handling",
      "Three.js interactive 3D particle storm rendering",
      "React 3D canvas preset: interactive procedural marble shader sphere",
    ],
  },
  {
    kind: "coding" as const, category: "backend",
    prompts: [
      "NextJS dashboard template with Tailwind and light/dark theme",
      "Python FastAPI server with auto-generated documentation and database connection",
      "React custom hook for handling asynchronous requests with cache and retry",
      "Automated regex compiler: synthesize and explain complex regex patterns",
    ],
  },
  {
    kind: "coding" as const, category: "web3",
    prompts: [
      "Smart contract in Solidity for NFT staking with reward distribution",
      "Contrast/debate helper: safe option, bold alternative, contrarian critique",
      "Fast rust CLI for batch-verifying on-chain signatures",
      "Solidity gas-optimization pass with before/after benchmark table",
    ],
  },
];

export function generateMoreMarketItems(count: number, currentLen: number, category?: string, kind?: MarketItem["kind"]): MarketItem[] {
  const items: MarketItem[] = [];
  let pool = category
    ? CREATION_TEMPLATES.filter((t) => t.category === category)
    : kind
    ? CREATION_TEMPLATES.filter((t) => t.kind === kind)
    : CREATION_TEMPLATES;
  if (pool.length === 0) pool = kind ? CREATION_TEMPLATES.filter((t) => t.kind === kind) : CREATION_TEMPLATES;
  if (pool.length === 0) pool = CREATION_TEMPLATES;
  for (let i = 0; i < count; i++) {
    const id = `generated_${currentLen + i}_${Math.random().toString(36).substring(2, 9)}`;
    const template = pool[Math.floor(Math.random() * pool.length)];
    const prompt = template.prompts[Math.floor(Math.random() * template.prompts.length)] + ` #${currentLen + i + 1}`;
    const kind = template.kind;
    const author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
    const model = MODELS_POOL[Math.floor(Math.random() * MODELS_POOL.length)];
    const likes = Math.floor(Math.random() * 800) + 120;

    // Static CDN, not live AI generation — pollinations.ai generates each
    // image on demand, which is slow and rate-limit-prone once dozens of
    // these fire at once (every generated grid tile), which is exactly what
    // was causing previews to render blank. picsum is a fast static image
    // CDN; seeding it with the item id keeps each item's thumbnail stable.
    let url = `https://picsum.photos/seed/${id}/300/300`;
    if (kind === "video") {
      url = VIDEO_POOL[Math.floor(Math.random() * VIDEO_POOL.length)];
    } else if (kind === "audio") {
      url = MUSIC_POOL[Math.floor(Math.random() * MUSIC_POOL.length)];
    }

    items.push({
      id,
      kind,
      prompt,
      model,
      author,
      likes,
      likedByUser: false,
      url,
      category: template.category,
    });
  }
  return items;
}
