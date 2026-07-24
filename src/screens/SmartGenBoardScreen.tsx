// Smart Gen Board — every Smart Gen item (project / reminder / memory /
// artifact) as a card on one kanban surface. A card's position against the
// board's linear backdrop carries its meaning by relativity — no table to
// parse, no dashboard to learn. Cards embed into each other in either
// direction without type bounds, convert freely between types, and carry
// per-card custom attributes on top of globally-managed per-type defaults.
// The Ask tab is the same MiniMax M3 model that does Smart Gen's background
// extraction, with the whole board as context and the power to change it.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput,
  LayoutAnimation, Modal, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useCollider, newId, findCard,
  type AppState, type CardEmbed, type LinkKind, type Reminder,
  type BoardGroupBy, type BoardSortBy,
  collapsePriority,
} from "../state";
import { Glass } from "../components/Glass";
import { Page } from "../components/Page";
import { Picker } from "../components/Picker";
import { styles, withFont, fontFamilyForWeight } from "../styles/theme";
import { useToast } from "../components/Toast";
import { Markdown } from "../components/Markdown";
import { smartGenChat, parseBoardActions, type BoardAction, type BoardCardBrief } from "../services/minimax";
import { friendlyErrorMessage } from "../services/chat";

const SCREEN_W = Dimensions.get("window").width;

export const KIND_COLORS: Record<LinkKind, string> = {
  project: "#5dbdff",
  reminder: "#a78bfa",
  memory: "#34d399",
  artifact: "#e2e8f0",
};
const KIND_ICONS: Record<LinkKind, keyof typeof Ionicons.glyphMap> = {
  project: "briefcase-outline",
  reminder: "alarm-outline",
  memory: "sparkles-outline",
  artifact: "layers-outline",
};
const ALL_KINDS: LinkKind[] = ["project", "reminder", "memory", "artifact"];
const RECURRING_OPTIONS: NonNullable<Reminder["recurring"]>[] = ["daily", "weekly", "monthly", "yearly"];

// ── Unified card shape ──────────────────────────────────────────────────────
export type BoardCard = {
  ref: CardEmbed;
  kind: LinkKind;
  title: string;
  body: string;
  due?: number;
  recurring?: Reminder["recurring"];
  priority: "high" | "none";
  // "none" = the kind has no meaningful progress (memories/artifacts) —
  // grouped as Reference, never forced into a fake todo state.
  progress: "todo" | "inprogress" | "done" | "none";
  tags: string[];
  projectId?: string;
  ts: number;
  embeds: CardEmbed[];
  customFields: Record<string, string>;
};

function memoryTitle(content: string): string {
  return content.split(/[.!?\n]/)[0].trim().slice(0, 80) || "Memory";
}

export function unifyCards(state: AppState): BoardCard[] {
  const cards: BoardCard[] = [];
  for (const p of state.projects) {
    const done = p.tasks.length > 0 && p.tasks.every((t) => t.done);
    cards.push({
      ref: { kind: "project", id: p.id }, kind: "project", title: p.name,
      body: p.tasks.length ? `${p.tasks.filter((t) => t.done).length}/${p.tasks.length} tasks done` : "No tasks yet",
      priority: p.tasks.some((t) => t.priority === "high" && !t.done) ? "high" : "none",
      progress: done ? "done" : p.tasks.some((t) => t.done) ? "inprogress" : "todo",
      tags: [], ts: 0, embeds: p.embeds || [], customFields: p.customFields || {},
    });
  }
  for (const r of state.reminders) {
    cards.push({
      ref: { kind: "reminder", id: r.id }, kind: "reminder", title: r.title, body: "",
      due: r.due, recurring: r.recurring, priority: collapsePriority(r.priority),
      progress: r.done ? "done" : r.progress === "inprogress" ? "inprogress" : "todo",
      tags: r.tags || [], projectId: r.projectId, ts: r.ts, embeds: r.embeds || [], customFields: r.customFields || {},
    });
  }
  for (const m of state.memories) {
    cards.push({
      // body only when the title had to truncate it — a short memory's full
      // text IS its title, and repeating it as body reads as a glitch.
      ref: { kind: "memory", id: m.id }, kind: "memory", title: memoryTitle(m.content), body: m.content.length > 84 ? m.content : "",
      priority: collapsePriority(m.priority), progress: "none",
      tags: m.tags || [], projectId: m.projectId, ts: m.ts, embeds: m.embeds || [], customFields: m.customFields || {},
    });
  }
  for (const a of state.artifacts) {
    cards.push({
      ref: { kind: "artifact", id: a.id }, kind: "artifact", title: a.title, body: a.content,
      priority: "none", progress: "none",
      tags: [], projectId: a.projectId, ts: a.ts, embeds: a.embeds || [], customFields: a.customFields || {},
    });
  }
  return cards;
}

// ── Live countdown ──────────────────────────────────────────────────────────
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatCountdown(due: number, now: number): { text: string; overdue: boolean; urgent: boolean } {
  const diff = due - now;
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const s = Math.floor(abs / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  let text: string;
  if (d >= 2) text = `${d}d ${h % 24}h`;
  else if (h >= 1) text = `${h}h ${m % 60}m`;
  else text = `${m}m ${(s % 60).toString().padStart(2, "0")}s`;
  return { text: overdue ? `${text} overdue` : text, overdue, urgent: !overdue && diff < 3600e3 };
}

// ── Grouping / sorting ──────────────────────────────────────────────────────
type Column = { key: string; label: string; color: string; cards: BoardCard[] };

function groupCards(cards: BoardCard[], groupBy: BoardGroupBy, state: AppState): Column[] {
  const cols: Column[] = [];
  const col = (key: string, label: string, color: string) => {
    let c = cols.find((x) => x.key === key);
    if (!c) { c = { key, label, color, cards: [] }; cols.push(c); }
    return c;
  };
  if (groupBy === "type") {
    col("project", "Projects", KIND_COLORS.project); col("reminder", "Reminders", KIND_COLORS.reminder);
    col("memory", "Memories", KIND_COLORS.memory); col("artifact", "Artifacts", KIND_COLORS.artifact);
    for (const c of cards) col(c.kind, c.kind, KIND_COLORS[c.kind]).cards.push(c);
  } else if (groupBy === "status") {
    col("todo", "To do", "#5dbdff"); col("inprogress", "In progress", "#a78bfa"); col("done", "Done", "#34d399");
    for (const c of cards) col(c.progress === "none" ? "reference" : c.progress, c.progress === "none" ? "Reference" : c.progress, c.progress === "none" ? "rgba(238,241,246,0.6)" : "#5dbdff").cards.push(c);
  } else if (groupBy === "priority") {
    col("high", "High priority", "#f87171"); col("none", "Everything else", "rgba(238,241,246,0.6)");
    for (const c of cards) col(c.priority, "", "").cards.push(c);
  } else if (groupBy === "project") {
    for (const p of state.projects) col(p.id, p.name, KIND_COLORS.project);
    col("__none", "Unfiled", "rgba(238,241,246,0.6)");
    for (const c of cards) {
      if (c.kind === "project") continue; // a project card isn't filed inside itself
      col(c.projectId && state.projects.some((p) => p.id === c.projectId) ? c.projectId! : "__none", "", "rgba(238,241,246,0.6)").cards.push(c);
    }
  } else {
    for (const t of Array.from(new Set(cards.flatMap((c) => c.tags))).sort()) col(t, `#${t}`, "#a78bfa");
    col("__none", "Untagged", "rgba(238,241,246,0.6)");
    for (const c of cards) {
      if (!c.tags.length) { col("__none", "", "").cards.push(c); continue; }
      for (const t of c.tags) col(t, "", "").cards.push(c);
    }
  }
  // Keep the structural columns of status/type views even when empty (an
  // empty "Done" column is information); drop empty project/tag columns
  // (an empty project column is just noise at this altitude).
  return cols.filter((c) => c.cards.length > 0 || groupBy === "status" || groupBy === "type");
}

function sortCards(cards: BoardCard[], sortBy: BoardSortBy): BoardCard[] {
  const arr = [...cards];
  if (sortBy === "due") arr.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity) || b.ts - a.ts);
  else if (sortBy === "created") arr.sort((a, b) => b.ts - a.ts);
  else if (sortBy === "priority") arr.sort((a, b) => (a.priority === b.priority ? (a.due ?? Infinity) - (b.due ?? Infinity) : a.priority === "high" ? -1 : 1));
  else arr.sort((a, b) => a.title.localeCompare(b.title));
  return arr;
}

// ── Small visual pieces ─────────────────────────────────────────────────────
function CountdownChip({ due, now }: { due: number; now: number }) {
  const { text, overdue, urgent } = formatCountdown(due, now);
  const color = overdue ? "#f87171" : urgent ? "#fbbf24" : "#5dbdff";
  return (
    <View style={[local.chip, { borderColor: `${color}55`, backgroundColor: `${color}14` }]}>
      <Ionicons name="time-outline" size={10} color={color} />
      <Text style={[local.chipText, { color }]}>{text}</Text>
    </View>
  );
}

function KindBadge({ kind }: { kind: LinkKind }) {
  const color = KIND_COLORS[kind];
  return (
    <View style={[local.chip, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
      <Ionicons name={KIND_ICONS[kind]} size={10} color={color} />
      <Text style={[local.chipText, { color }]}>{kind.toUpperCase()}</Text>
    </View>
  );
}

function BoardCardView({ card, now, all, onOpen, compact }: {
  card: BoardCard; now: number; all: BoardCard[]; onOpen: (ref: CardEmbed) => void; compact?: boolean;
}) {
  const color = KIND_COLORS[card.kind];
  const embedded = card.embeds.map((e) => all.find((c) => c.ref.kind === e.kind && c.ref.id === e.id)).filter(Boolean) as BoardCard[];
  const fieldEntries = Object.entries(card.customFields).filter(([, v]) => v?.trim()).slice(0, 3);
  return (
    <Pressable onPress={() => onOpen(card.ref)}>
      <Glass style={[local.card, card.priority === "high" && local.cardHigh]}>
        <View style={[local.cardAccent, { backgroundColor: color }]} />
        <View style={{ flex: 1, padding: 10, gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <Ionicons name={KIND_ICONS[card.kind]} size={12} color={color} style={{ marginTop: 2 }} />
            <Text style={[local.cardTitle, card.progress === "done" && { textDecorationLine: "line-through", color: "rgba(238,241,246,0.4)" }]} numberOfLines={2}>
              {card.title}
            </Text>
            {card.priority === "high" && (
              <Text style={{ color: "#f87171", fontSize: 9, fontWeight: "900", fontFamily: fontFamilyForWeight(900), textShadowColor: "#f87171", textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 }, marginTop: 2 }}>HIGH</Text>
            )}
          </View>
          {!compact && !!card.body && card.kind !== "reminder" && (
            <Text style={local.cardBody} numberOfLines={2}>{card.body}</Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {card.due != null && <CountdownChip due={card.due} now={now} />}
            {card.recurring && (
              <View style={[local.chip, { borderColor: "rgba(167,139,250,0.35)", backgroundColor: "rgba(167,139,250,0.1)" }]}>
                <Ionicons name="repeat-outline" size={10} color="#a78bfa" />
                <Text style={[local.chipText, { color: "#a78bfa" }]}>{card.recurring}</Text>
              </View>
            )}
            {card.tags.slice(0, 3).map((t) => (
              <Text key={t} style={local.tagText}>#{t}</Text>
            ))}
          </View>
          {!compact && fieldEntries.length > 0 && (
            <View style={{ gap: 1 }}>
              {fieldEntries.map(([k, v]) => (
                <Text key={k} style={local.fieldLine} numberOfLines={1}>
                  <Text style={{ color: "rgba(238,241,246,0.45)" }}>{k}: </Text>{v}
                </Text>
              ))}
            </View>
          )}
          {/* Embedded cards — physically inside their host, tappable through
              to their own detail. The form lives in the deadline card, the
              recipe in the dinner reminder — reference at the point of
              relevance, no app-hopping. */}
          {embedded.length > 0 && (
            <View style={{ gap: 4, marginTop: 2 }}>
              {embedded.map((e) => (
                <Pressable key={`${e.ref.kind}:${e.ref.id}`} onPress={() => onOpen(e.ref)} style={[local.embedRow, { borderColor: `${KIND_COLORS[e.kind]}30` }]}>
                  <Ionicons name={KIND_ICONS[e.kind]} size={11} color={KIND_COLORS[e.kind]} />
                  <Text style={local.embedTitle} numberOfLines={1}>{e.title}</Text>
                  {e.due != null && <CountdownChip due={e.due} now={now} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Glass>
    </Pressable>
  );
}

// ── Calendar sections ───────────────────────────────────────────────────────
function calendarSections(cards: BoardCard[], now: number) {
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const today0 = dayStart.getTime();
  const sections: { key: string; label: string; color: string; cards: BoardCard[] }[] = [
    { key: "overdue", label: "Overdue", color: "#f87171", cards: [] },
    { key: "today", label: "Today", color: "#fbbf24", cards: [] },
    { key: "tomorrow", label: "Tomorrow", color: "#a78bfa", cards: [] },
    { key: "week", label: "This week", color: "#5dbdff", cards: [] },
    { key: "later", label: "Later", color: "#34d399", cards: [] },
    { key: "nodate", label: "No date", color: "rgba(238,241,246,0.6)", cards: [] },
  ];
  for (const c of cards) {
    if (c.due == null) { sections[5].cards.push(c); continue; }
    if (c.due < now && c.progress !== "done") sections[0].cards.push(c);
    else if (c.due < today0 + 86400e3) sections[1].cards.push(c);
    else if (c.due < today0 + 2 * 86400e3) sections[2].cards.push(c);
    else if (c.due < today0 + 7 * 86400e3) sections[3].cards.push(c);
    else sections[4].cards.push(c);
  }
  for (const s of sections) s.cards.sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  return sections.filter((s) => s.cards.length > 0);
}

// ── Board-chat action execution ─────────────────────────────────────────────
function parseDueString(due?: string | null): number | undefined {
  if (!due) return undefined;
  const m = due.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (!m) return undefined;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 9, m[5] ? +m[5] : 0).getTime();
}

function executeBoardActions(actions: BoardAction[], dispatch: any, getState: () => AppState): number {
  let applied = 0;
  for (const a of actions) {
    try {
      const state = getState();
      if (a.action === "create") {
        const id = newId(a.cardType === "artifact" ? "art" : a.cardType[0]);
        const projectId = a.projectName ? state.projects.find((p) => p.name.trim().toLowerCase() === a.projectName!.trim().toLowerCase())?.id : undefined;
        if (a.cardType === "memory") dispatch({ type: "memory", id, content: a.content || a.title, tags: a.tags, projectId, priority: a.priority, fingerprint: id });
        else if (a.cardType === "reminder") dispatch({ type: "reminder", id, title: a.title, due: parseDueString(a.due), priority: a.priority, projectId, tags: a.tags, isTask: a.isTask, recurring: a.recurring, fingerprint: id });
        else if (a.cardType === "project") dispatch({ type: "project", id, name: a.title, fingerprint: id });
        else dispatch({ type: "artifact", id, title: a.title, content: a.content || "", kind: "custom", projectId, fingerprint: id });
        if (a.fields && Object.keys(a.fields).length) dispatch({ type: "setCardFields", ref: { kind: a.cardType, id }, fields: a.fields });
        applied++;
      } else if (a.action === "update") {
        const ref = ALL_KINDS.map((k) => ({ kind: k, id: a.cardId })).find((r) => findCard(state, r));
        if (!ref) continue;
        const item: any = findCard(state, ref)!;
        if (ref.kind === "memory") dispatch({ type: "updateMemory", memory: { ...item, content: a.content ?? a.title ?? item.content, tags: a.tags ?? item.tags, priority: a.priority ?? item.priority } });
        else if (ref.kind === "reminder") dispatch({ type: "updateReminder", reminder: { ...item, title: a.title ?? item.title, due: a.due === null ? undefined : a.due !== undefined ? parseDueString(a.due) : item.due, priority: a.priority ?? item.priority, progress: a.progress ?? item.progress, done: (a.progress ?? item.progress) === "done", recurring: a.recurring === null ? undefined : a.recurring ?? item.recurring, tags: a.tags ?? item.tags } });
        else if (ref.kind === "project") dispatch({ type: "updateProject", project: { ...item, name: a.title ?? item.name } });
        else dispatch({ type: "updateArtifact", artifact: { ...item, title: a.title ?? item.title, content: a.content ?? item.content } });
        if (a.fields) dispatch({ type: "setCardFields", ref, fields: { ...(item.customFields || {}), ...a.fields } });
        applied++;
      } else if (a.action === "convert") {
        const ref = ALL_KINDS.map((k) => ({ kind: k, id: a.cardId })).find((r) => findCard(state, r));
        if (ref) { dispatch({ type: "convertCard", ref, toKind: a.toType }); applied++; }
      } else if (a.action === "embed") {
        const cardRef = ALL_KINDS.map((k) => ({ kind: k, id: a.cardId })).find((r) => findCard(state, r));
        const hostRef = ALL_KINDS.map((k) => ({ kind: k, id: a.intoCardId })).find((r) => findCard(state, r));
        if (cardRef && hostRef) { dispatch({ type: "embedCard", host: hostRef, card: cardRef }); applied++; }
      } else if (a.action === "board") {
        const config: any = {};
        if (a.view) config.view = a.view;
        if (a.groupBy) config.groupBy = a.groupBy;
        if (a.sortBy) config.sortBy = a.sortBy;
        if (Object.keys(config).length) { dispatch({ type: "setBoardConfig", config }); applied++; }
      }
    } catch {
      // One malformed action never blocks the rest of the batch.
    }
  }
  return applied;
}

function toBriefs(cards: BoardCard[], state: AppState): BoardCardBrief[] {
  return cards.map((c) => ({
    id: c.ref.id,
    type: c.kind,
    title: c.title,
    due: c.due,
    priority: c.priority,
    progress: c.progress === "none" ? undefined : c.progress,
    recurring: c.recurring,
    tags: c.tags.length ? c.tags : undefined,
    projectName: c.projectId ? state.projects.find((p) => p.id === c.projectId)?.name : undefined,
    embeds: c.embeds.length || undefined,
    fields: Object.keys(c.customFields).length ? c.customFields : undefined,
  }));
}

// ── Chat message shape (screen-local, session-scoped) ───────────────────────
type BoardChatMsg = { id: string; role: "user" | "assistant"; content: string; applied?: number; streaming?: boolean };

// ── Main screen ─────────────────────────────────────────────────────────────
export function SmartGenBoardScreen({ goBack }: { goBack: () => void }) {
  const { state, dispatch, getState } = useCollider();
  const { toast } = useToast();
  const { view, groupBy, sortBy, filter } = state.smartBoard;
  const [askMode, setAskMode] = useState(false);
  const [detailRef, setDetailRef] = useState<CardEmbed | null>(null);
  const [fieldsManagerOpen, setFieldsManagerOpen] = useState(false);

  const allCards = useMemo(() => unifyCards(state), [state.projects, state.reminders, state.memories, state.artifacts]);
  const hasUrgent = allCards.some((c) => c.due != null && c.due - Date.now() < 3600e3 && c.due > Date.now() - 86400e3);
  const now = useNow(hasUrgent ? 1000 : 30000);

  const embeddedIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCards) for (const e of c.embeds) set.add(`${e.kind}:${e.id}`);
    return set;
  }, [allCards]);

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    // An embedded card lives inside its host at top level (same as a Trello
    // checklist row not also being a standalone card) — but text search
    // always reaches everything, embedded or not.
    let list = allCards.filter((c) => (f ? true : !embeddedIds.has(`${c.ref.kind}:${c.ref.id}`)));
    if (f) list = list.filter((c) => `${c.title} ${c.body} ${c.tags.join(" ")} ${Object.entries(c.customFields).flat().join(" ")}`.toLowerCase().includes(f));
    return sortCards(list, sortBy);
  }, [allCards, embeddedIds, filter, sortBy]);

  const columns = useMemo(() => groupCards(visible, groupBy, state), [visible, groupBy, state.projects]);
  const openDetail = (ref: CardEmbed) => setDetailRef(ref);

  const groupOptions = [
    { label: "Group: Status", value: "status" }, { label: "Group: Type", value: "type" },
    { label: "Group: Priority", value: "priority" }, { label: "Group: Project", value: "project" },
    { label: "Group: Tag", value: "tag" },
  ];
  const sortOptions = [
    { label: "Sort: Due", value: "due" }, { label: "Sort: Created", value: "created" },
    { label: "Sort: Priority", value: "priority" }, { label: "Sort: Title", value: "title" },
  ];

  const colW = Math.min(SCREEN_W * 0.72, 300);

  return (
    <Page title="Smart Gen Board" goBack={goBack} noScroll>
      <View style={{ flex: 1, backgroundColor: "#07080b" }}>
        {/* View switcher — the board type is itself an adjustable attribute,
            for the user and for the model alike (board action "board"). */}
        <View style={local.switcherRow}>
          {([["board", "grid-outline", "Board"], ["list", "list-outline", "List"], ["calendar", "calendar-outline", "Calendar"], ["ask", "chatbubble-ellipses-outline", "Ask"]] as const).map(([v, icon, label]) => {
            const active = v === "ask" ? askMode : !askMode && view === v;
            return (
              <Pressable
                key={v}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  if (v === "ask") setAskMode(true);
                  else { setAskMode(false); dispatch({ type: "setBoardConfig", config: { view: v } }); }
                }}
                style={[local.switcherBtn, active && local.switcherBtnActive]}
              >
                <Ionicons name={icon} size={13} color={active ? "#a78bfa" : "rgba(238,241,246,0.5)"} />
                <Text style={[local.switcherText, active && { color: "#fff" }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {!askMode && (
          <>
            {/* Controls: grouping, sorting, filter, global field manager */}
            <View style={local.controlsRow}>
              <View style={{ flex: 1 }}>
                <Picker value={groupBy} onChange={(v) => dispatch({ type: "setBoardConfig", config: { groupBy: v as BoardGroupBy } })} options={groupOptions} />
              </View>
              <View style={{ flex: 1 }}>
                <Picker value={sortBy} onChange={(v) => dispatch({ type: "setBoardConfig", config: { sortBy: v as BoardSortBy } })} options={sortOptions} />
              </View>
              <Pressable onPress={() => setFieldsManagerOpen(true)} style={local.iconBtn}>
                <Ionicons name="options-outline" size={15} color="rgba(238,241,246,0.7)" />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 12, marginTop: 6 }}>
              <View style={local.searchContainer}>
                <Ionicons name="search" size={13} color="rgba(255,255,255,0.4)" style={{ marginRight: 7 }} />
                <TextInput
                  value={filter}
                  onChangeText={(t) => dispatch({ type: "setBoardConfig", config: { filter: t } })}
                  placeholder="Filter cards..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={local.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {filter.length > 0 && (
                  <Pressable onPress={() => dispatch({ type: "setBoardConfig", config: { filter: "" } })} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                )}
              </View>
            </View>

            {view === "board" && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
                {columns.map((c) => (
                  <View key={c.key} style={{ width: colW }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, paddingHorizontal: 2 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.color, shadowColor: c.color, shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
                      <Text style={local.colTitle}>{c.label}</Text>
                      <Text style={local.colCount}>{c.cards.length}</Text>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 30 }}>
                      {c.cards.map((card) => (
                        <BoardCardView key={`${card.ref.kind}:${card.ref.id}`} card={card} now={now} all={allCards} onOpen={openDetail} />
                      ))}
                      {c.cards.length === 0 && <Text style={local.emptyCol}>Nothing here</Text>}
                    </ScrollView>
                  </View>
                ))}
              </ScrollView>
            )}

            {view === "list" && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 40, gap: 8 }}>
                {columns.map((c) => (
                  <View key={c.key} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.color }} />
                      <Text style={local.colTitle}>{c.label}</Text>
                      <Text style={local.colCount}>{c.cards.length}</Text>
                    </View>
                    {c.cards.map((card) => (
                      <BoardCardView key={`${card.ref.kind}:${card.ref.id}`} card={card} now={now} all={allCards} onOpen={openDetail} compact />
                    ))}
                  </View>
                ))}
                {visible.length === 0 && <Text style={[styles.muted, { textAlign: "center", marginTop: 60 }]}>No cards yet — Smart Gen fills this board from your conversations.</Text>}
              </ScrollView>
            )}

            {view === "calendar" && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 40, gap: 8 }}>
                {calendarSections(visible, now).map((s) => (
                  <View key={s.key} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.color, shadowColor: s.color, shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
                      <Text style={[local.colTitle, { color: s.color }]}>{s.label}</Text>
                      <Text style={local.colCount}>{s.cards.length}</Text>
                    </View>
                    {s.cards.map((card) => (
                      <View key={`${card.ref.kind}:${card.ref.id}`}>
                        {card.due != null && (
                          <Text style={local.calDate}>
                            {new Date(card.due).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            {" · "}
                            {new Date(card.due).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </Text>
                        )}
                        <BoardCardView card={card} now={now} all={allCards} onOpen={openDetail} />
                      </View>
                    ))}
                  </View>
                ))}
                {visible.length === 0 && <Text style={[styles.muted, { textAlign: "center", marginTop: 60 }]}>Nothing scheduled.</Text>}
              </ScrollView>
            )}
          </>
        )}

        {askMode && <BoardChat allCards={allCards} openDetail={openDetail} />}
      </View>

      {detailRef && (
        <CardDetailModal
          key={`${detailRef.kind}:${detailRef.id}`}
          cardRef={detailRef}
          allCards={allCards}
          now={now}
          onClose={() => setDetailRef(null)}
          onOpenOther={(r) => setDetailRef(r)}
        />
      )}
      {fieldsManagerOpen && <TypeFieldsManager onClose={() => setFieldsManagerOpen(false)} />}
    </Page>
  );
}

// ── Ask tab — MiniMax M3 with the board as context, acting directly ─────────
function BoardChat({ allCards, openDetail }: { allCards: BoardCard[]; openDetail: (ref: CardEmbed) => void }) {
  const { state, dispatch, getState } = useCollider();
  const { toast } = useToast();
  const [messages, setMessages] = useState<BoardChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [useWeb, setUseWeb] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: BoardChatMsg = { id: newId("bc"), role: "user", content: prompt };
    const draftId = newId("bc");
    setMessages((prev) => [...prev, userMsg, { id: draftId, role: "assistant", content: "", streaming: true }]);
    try {
      const history = messages.map((m) => ({ id: m.id, role: m.role, content: m.content, ts: 0 }));
      const briefs = toBriefs(unifyCards(getState()), getState());
      const raw = await smartGenChat(history as any, prompt, briefs, {
        webSearch: useWeb,
        onToken: (partial) => {
          // Hide a half-received action block while streaming; it renders as
          // an "applied" chip once complete, never as raw JSON.
          const visible = partial.split("```collider-actions")[0];
          setMessages((prev) => prev.map((m) => (m.id === draftId ? { ...m, content: visible } : m)));
        },
      });
      const { prose, actions } = parseBoardActions(raw);
      const applied = executeBoardActions(actions, dispatch, getState);
      setMessages((prev) => prev.map((m) => (m.id === draftId ? { ...m, content: prose || (applied ? "Done." : ""), applied, streaming: false } : m)));
      if (applied) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === draftId ? { ...m, content: friendlyErrorMessage(e), streaming: false } : m)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 10, flexGrow: 1 }}
      >
        {messages.length === 0 && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 20 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="rgba(167,139,250,0.5)" />
            <Text style={[styles.muted, { textAlign: "center", fontSize: 12, lineHeight: 18 }]}>
              Ask about anything on your board — or ask for something new. "What's left to do in my case?" · "Did I start my favorite-movies list yet?" It answers from the board and makes the change in the same breath.
            </Text>
          </View>
        )}
        {messages.map((m) => (
          <View key={m.id} style={[local.bubble, m.role === "user" ? local.bubbleUser : local.bubbleAssistant]}>
            {m.role === "assistant" ? (
              <>
                {m.streaming && !m.content ? (
                  <ActivityIndicator size="small" color="#a78bfa" />
                ) : (
                  <Markdown content={m.content} fontSize={12.5} />
                )}
                {!!m.applied && (
                  <View style={local.appliedChip}>
                    <Ionicons name="checkmark-circle" size={11} color="#34d399" />
                    <Text style={{ color: "#34d399", fontSize: 10, fontWeight: "800", fontFamily: fontFamilyForWeight(800) }}>
                      {m.applied} board change{m.applied > 1 ? "s" : ""} applied
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ color: "#fff", fontSize: 12.5, lineHeight: 18 }}>{m.content}</Text>
            )}
          </View>
        ))}
      </ScrollView>
      <View style={local.chatInputRow}>
        <Pressable onPress={() => setUseWeb((w) => !w)} style={[local.iconBtn, useWeb && { backgroundColor: "rgba(93,189,255,0.15)", borderColor: "rgba(93,189,255,0.45)", borderWidth: 1 }]}>
          <Ionicons name="globe-outline" size={15} color={useWeb ? "#5dbdff" : "rgba(238,241,246,0.5)"} />
        </Pressable>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask your board..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={local.chatInput}
          multiline
          onSubmitEditing={send}
        />
        <Pressable accessibilityLabel="Send" onPress={send} disabled={busy || !input.trim()} style={[local.sendBtn, (busy || !input.trim()) && { opacity: 0.4 }]}>
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={16} color="#fff" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Card detail modal ───────────────────────────────────────────────────────
function CardDetailModal({ cardRef, allCards, now, onClose, onOpenOther }: {
  cardRef: CardEmbed; allCards: BoardCard[]; now: number; onClose: () => void; onOpenOther: (ref: CardEmbed) => void;
}) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();
  const item: any = findCard(state, cardRef);
  const card = allCards.find((c) => c.ref.kind === cardRef.kind && c.ref.id === cardRef.id);
  const [title, setTitle] = useState<string>(card?.title || "");
  const [body, setBody] = useState<string>(cardRef.kind === "memory" ? item?.content || "" : cardRef.kind === "artifact" ? item?.content || "" : "");
  const [embedPickerOpen, setEmbedPickerOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  if (!item || !card) return null;

  const color = KIND_COLORS[cardRef.kind];
  const typeDefaults = state.cardTypeFields[cardRef.kind] || [];
  const fields: Record<string, string> = { ...Object.fromEntries(typeDefaults.map((k) => [k, ""])), ...(item.customFields || {}) };

  const saveText = () => {
    if (cardRef.kind === "memory") dispatch({ type: "updateMemory", memory: { ...item, content: body.trim() || item.content } });
    else if (cardRef.kind === "reminder") dispatch({ type: "updateReminder", reminder: { ...item, title: title.trim() || item.title } });
    else if (cardRef.kind === "project") dispatch({ type: "updateProject", project: { ...item, name: title.trim() || item.name } });
    else dispatch({ type: "updateArtifact", artifact: { ...item, title: title.trim() || item.title, content: body } });
  };
  const setField = (k: string, v: string) => {
    dispatch({ type: "setCardFields", ref: cardRef, fields: { ...(item.customFields || {}), [k]: v } });
  };
  const removeField = (k: string) => {
    const nextFields = { ...(item.customFields || {}) };
    delete nextFields[k];
    dispatch({ type: "setCardFields", ref: cardRef, fields: nextFields });
  };
  const setDueQuick = (due?: number) => {
    dispatch({ type: "updateReminder", reminder: { ...item, due } });
  };
  const convert = (toKind: LinkKind) => {
    saveText();
    dispatch({ type: "convertCard", ref: cardRef, toKind });
    toast(`Converted to ${toKind}`);
    onClose();
  };
  const remove = () => {
    const actionMap: Record<LinkKind, string> = { memory: "removeMemory", reminder: "removeReminder", project: "removeProject", artifact: "removeArtifact" };
    dispatch({ type: actionMap[cardRef.kind], id: cardRef.id } as any);
    onClose();
  };

  const embedded = card.embeds.map((e) => allCards.find((c) => c.ref.kind === e.kind && c.ref.id === e.id)).filter(Boolean) as BoardCard[];
  const tomorrow9 = () => { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); };
  const nextWeek9 = () => { const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d.getTime(); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { saveText(); onClose(); }}>
      <View style={local.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { saveText(); onClose(); }} />
        <Glass style={local.modalSheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <KindBadge kind={cardRef.kind} />
              {card.due != null && <CountdownChip due={card.due} now={now} />}
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => { saveText(); onClose(); }} hitSlop={8}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            {cardRef.kind !== "memory" && (
              <TextInput value={title} onChangeText={setTitle} onEndEditing={saveText} style={local.modalTitleInput} placeholder="Title" placeholderTextColor="rgba(255,255,255,0.3)" multiline />
            )}
            {(cardRef.kind === "memory" || cardRef.kind === "artifact") && (
              <TextInput value={body} onChangeText={setBody} onEndEditing={saveText} style={local.modalBodyInput} placeholder={cardRef.kind === "memory" ? "Memory content" : "Artifact content"} placeholderTextColor="rgba(255,255,255,0.3)" multiline />
            )}

            {/* Reminder-specific: due + recurring — present because reminders
                are usually time-constrained, optional because they aren't
                logically time-constrained. */}
            {cardRef.kind === "reminder" && (
              <View style={{ gap: 8 }}>
                <Text style={local.sectionLabel}>DUE</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {([["Tonight 8pm", () => { const d = new Date(now); d.setHours(20, 0, 0, 0); return d.getTime(); }], ["Tomorrow 9am", tomorrow9], ["Next week", nextWeek9]] as const).map(([label, fn]) => (
                    <Pressable key={label} onPress={() => setDueQuick(fn())} style={local.quickChip}>
                      <Text style={local.quickChipText}>{label}</Text>
                    </Pressable>
                  ))}
                  {item.due != null && (
                    <Pressable onPress={() => setDueQuick(undefined)} style={[local.quickChip, { borderColor: "rgba(248,113,113,0.4)" }]}>
                      <Text style={[local.quickChipText, { color: "#f87171" }]}>Clear</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={local.sectionLabel}>REPEATS</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {RECURRING_OPTIONS.map((r) => (
                    <Pressable key={r} onPress={() => dispatch({ type: "updateReminder", reminder: { ...item, recurring: item.recurring === r ? undefined : r } })} style={[local.quickChip, item.recurring === r && { backgroundColor: "rgba(167,139,250,0.16)", borderColor: "rgba(167,139,250,0.5)" }]}>
                      <Text style={[local.quickChipText, item.recurring === r && { color: "#a78bfa" }]}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable onPress={() => dispatch({ type: "cycleReminderProgress", id: item.id })} style={local.quickChip}>
                    <Text style={local.quickChipText}>Status: {card.progress}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => dispatch({ type: "updateReminder", reminder: { ...item, priority: collapsePriority(item.priority) === "high" ? "none" : "high" } })}
                    style={[local.quickChip, collapsePriority(item.priority) === "high" && { borderColor: "rgba(248,113,113,0.5)", backgroundColor: "rgba(248,113,113,0.12)" }]}
                  >
                    <Text style={[local.quickChipText, collapsePriority(item.priority) === "high" && { color: "#f87171" }]}>High priority</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Custom attributes: global type defaults + per-card additions.
                The type's defaults always show (availability is the point);
                per-card fields extend them without ceremony. */}
            <Text style={local.sectionLabel}>ATTRIBUTES</Text>
            <View style={{ gap: 6 }}>
              {Object.entries(fields).map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[local.fieldName]} numberOfLines={1}>{k}</Text>
                  <TextInput
                    defaultValue={v}
                    onEndEditing={(e) => setField(k, e.nativeEvent.text)}
                    placeholder="—"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    style={local.fieldInput}
                  />
                  {!typeDefaults.includes(k) && (
                    <Pressable onPress={() => removeField(k)} hitSlop={6}>
                      <Ionicons name="close-circle-outline" size={14} color="rgba(255,255,255,0.35)" />
                    </Pressable>
                  )}
                </View>
              ))}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TextInput
                  value={newFieldName}
                  onChangeText={setNewFieldName}
                  placeholder="Add attribute..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={[local.fieldInput, { flex: 1 }]}
                  onSubmitEditing={() => { if (newFieldName.trim()) { setField(newFieldName.trim(), ""); setNewFieldName(""); } }}
                />
                <Pressable onPress={() => { if (newFieldName.trim()) { setField(newFieldName.trim(), ""); setNewFieldName(""); } }} style={local.iconBtn}>
                  <Ionicons name="add" size={15} color="rgba(238,241,246,0.7)" />
                </Pressable>
              </View>
            </View>

            {/* Embeds — either direction, any type. */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={local.sectionLabel}>EMBEDDED CARDS</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setEmbedPickerOpen(true)} style={[local.quickChip, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
                <Ionicons name="add" size={12} color="rgba(238,241,246,0.7)" />
                <Text style={local.quickChipText}>Embed a card</Text>
              </Pressable>
            </View>
            {embedded.length === 0 ? (
              <Text style={[styles.muted, { fontSize: 11 }]}>Nothing embedded. Any card can hold any other card — a form inside a deadline, a list inside a project.</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {embedded.map((e) => (
                  <View key={`${e.ref.kind}:${e.ref.id}`} style={[local.embedRow, { borderColor: `${KIND_COLORS[e.kind]}30` }]}>
                    <Ionicons name={KIND_ICONS[e.kind]} size={11} color={KIND_COLORS[e.kind]} />
                    <Pressable style={{ flex: 1 }} onPress={() => onOpenOther(e.ref)}>
                      <Text style={local.embedTitle} numberOfLines={1}>{e.title}</Text>
                    </Pressable>
                    <Pressable onPress={() => dispatch({ type: "unembedCard", host: cardRef, card: e.ref })} hitSlop={6}>
                      <Ionicons name="close-circle-outline" size={14} color="rgba(255,255,255,0.35)" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Convert — form changes, identity and connections stay. */}
            <Text style={local.sectionLabel}>CONVERT TO</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {ALL_KINDS.filter((k) => k !== cardRef.kind).map((k) => (
                <Pressable key={k} onPress={() => convert(k)} style={[local.quickChip, { borderColor: `${KIND_COLORS[k]}45`, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                  <Ionicons name={KIND_ICONS[k]} size={11} color={KIND_COLORS[k]} />
                  <Text style={[local.quickChipText, { color: KIND_COLORS[k] }]}>{k}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={remove} style={[local.quickChip, { alignSelf: "flex-start", borderColor: "rgba(248,113,113,0.4)", marginTop: 4 }]}>
              <Text style={[local.quickChipText, { color: "#f87171" }]}>Delete card</Text>
            </Pressable>
          </ScrollView>
        </Glass>
      </View>

      {embedPickerOpen && (
        <EmbedPicker
          host={cardRef}
          allCards={allCards}
          onClose={() => setEmbedPickerOpen(false)}
          onPick={(picked) => {
            dispatch({ type: "embedCard", host: cardRef, card: picked });
            setEmbedPickerOpen(false);
          }}
        />
      )}
    </Modal>
  );
}

// ── Embed picker ────────────────────────────────────────────────────────────
function EmbedPicker({ host, allCards, onClose, onPick }: {
  host: CardEmbed; allCards: BoardCard[]; onClose: () => void; onPick: (ref: CardEmbed) => void;
}) {
  const [q, setQ] = useState("");
  const hostCard = allCards.find((c) => c.ref.kind === host.kind && c.ref.id === host.id);
  const candidates = allCards.filter((c) => {
    if (c.ref.kind === host.kind && c.ref.id === host.id) return false;
    if (hostCard?.embeds.some((e) => e.kind === c.ref.kind && e.id === c.ref.id)) return false;
    // A direct cycle (the candidate already embeds the host) can't render.
    if (c.embeds.some((e) => e.kind === host.kind && e.id === host.id)) return false;
    return !q.trim() || `${c.title} ${c.body}`.toLowerCase().includes(q.trim().toLowerCase());
  });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={local.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Glass style={[local.modalSheet, { maxHeight: "70%" }]}>
          <View style={{ padding: 16, gap: 10, flex: 1 }}>
            <Text style={local.sectionLabel}>EMBED A CARD — ANY TYPE, EITHER DIRECTION</Text>
            <View style={local.searchContainer}>
              <Ionicons name="search" size={13} color="rgba(255,255,255,0.4)" style={{ marginRight: 7 }} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search cards..." placeholderTextColor="rgba(255,255,255,0.3)" style={local.searchInput} autoFocus />
            </View>
            <ScrollView contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
              {candidates.map((c) => (
                <Pressable key={`${c.ref.kind}:${c.ref.id}`} onPress={() => onPick(c.ref)} style={[local.embedRow, { borderColor: `${KIND_COLORS[c.kind]}30` }]}>
                  <Ionicons name={KIND_ICONS[c.kind]} size={11} color={KIND_COLORS[c.kind]} />
                  <Text style={local.embedTitle} numberOfLines={1}>{c.title}</Text>
                </Pressable>
              ))}
              {candidates.length === 0 && <Text style={[styles.muted, { fontSize: 11, textAlign: "center", marginTop: 20 }]}>No embeddable cards match.</Text>}
            </ScrollView>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

// ── Global per-type field manager ───────────────────────────────────────────
function TypeFieldsManager({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useCollider();
  const [kind, setKind] = useState<LinkKind>("reminder");
  const [newName, setNewName] = useState("");
  const fields = state.cardTypeFields[kind] || [];
  const add = () => {
    const name = newName.trim();
    if (!name || fields.includes(name)) return;
    dispatch({ type: "setTypeFields", kind, fields: [...fields, name] });
    setNewName("");
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={local.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Glass style={[local.modalSheet, { maxHeight: "70%" }]}>
          <View style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={local.sectionLabel}>DEFAULT ATTRIBUTES PER CARD TYPE</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {ALL_KINDS.map((k) => (
                <Pressable key={k} onPress={() => setKind(k)} style={[local.quickChip, kind === k && { backgroundColor: `${KIND_COLORS[k]}18`, borderColor: `${KIND_COLORS[k]}55` }]}>
                  <Text style={[local.quickChipText, kind === k && { color: KIND_COLORS[k] }]}>{k}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ gap: 6 }}>
              {fields.map((f) => (
                <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[local.fieldName, { flex: 1, maxWidth: undefined }]}>{f}</Text>
                  <Pressable onPress={() => dispatch({ type: "setTypeFields", kind, fields: fields.filter((x) => x !== f) })} hitSlop={6}>
                    <Ionicons name="close-circle-outline" size={15} color="rgba(255,255,255,0.35)" />
                  </Pressable>
                </View>
              ))}
              {fields.length === 0 && <Text style={[styles.muted, { fontSize: 11 }]}>No defaults for this type — every card of it starts clean.</Text>}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="New default attribute..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={[local.fieldInput, { flex: 1 }]}
                  onSubmitEditing={add}
                />
                <Pressable onPress={add} style={local.iconBtn}>
                  <Ionicons name="add" size={15} color="rgba(238,241,246,0.7)" />
                </Pressable>
              </View>
            </View>
            <Text style={[styles.muted, { fontSize: 10.5, lineHeight: 15 }]}>
              These appear on every {kind} card automatically. Individual cards can add their own attributes on top.
            </Text>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create(withFont({
  switcherRow: { flexDirection: "row", gap: 6, paddingHorizontal: 12, marginTop: 8 },
  switcherBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "transparent" },
  switcherBtnActive: { backgroundColor: "rgba(167,139,250,0.14)", borderColor: "rgba(167,139,250,0.4)" },
  switcherText: { color: "rgba(238,241,246,0.5)", fontSize: 10.5, fontWeight: "800", fontFamily: fontFamilyForWeight(800) },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, marginTop: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, height: 34 },
  searchInput: { flex: 1, color: "#fff", fontSize: 12, height: "100%", padding: 0 },
  colTitle: { color: "#fff", fontSize: 11.5, fontWeight: "900", fontFamily: fontFamilyForWeight(900), letterSpacing: 0.4, textTransform: "capitalize" },
  colCount: { color: "rgba(238,241,246,0.4)", fontSize: 10.5, fontWeight: "800", fontFamily: fontFamilyForWeight(800) },
  emptyCol: { color: "rgba(238,241,246,0.3)", fontSize: 11, textAlign: "center", paddingVertical: 20 },
  calDate: { color: "rgba(238,241,246,0.5)", fontSize: 10, fontWeight: "700", fontFamily: fontFamilyForWeight(700), marginBottom: 3, marginLeft: 2 },
  card: { borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(18,18,22,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row" },
  cardHigh: { borderColor: "rgba(248,113,113,0.35)", shadowColor: "#f87171", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  cardAccent: { width: 3.5 },
  cardTitle: { flex: 1, color: "#fff", fontSize: 12.5, fontWeight: "800", fontFamily: fontFamilyForWeight(800), lineHeight: 16 },
  cardBody: { color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 15 },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, borderWidth: 1 },
  chipText: { fontSize: 9, fontWeight: "800", fontFamily: fontFamilyForWeight(800), fontVariant: ["tabular-nums"] },
  tagText: { color: "rgba(167,139,250,0.85)", fontSize: 9.5, fontWeight: "700", fontFamily: fontFamilyForWeight(700) },
  fieldLine: { color: "rgba(238,241,246,0.8)", fontSize: 10 },
  embedRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.03)" },
  embedTitle: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 10.5, fontWeight: "700", fontFamily: fontFamilyForWeight(700) },
  bubble: { maxWidth: "88%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: "rgba(167,139,250,0.16)", borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  bubbleAssistant: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  appliedChip: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(52,211,153,0.1)", borderWidth: 1, borderColor: "rgba(52,211,153,0.3)" },
  chatInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  chatInput: { flex: 1, color: "#fff", fontSize: 12.5, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 9, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(167,139,250,0.35)", borderWidth: 1, borderColor: "rgba(167,139,250,0.6)", alignItems: "center", justifyContent: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalSheet: { width: "100%", maxWidth: 460, maxHeight: "85%", borderRadius: 20, overflow: "hidden", backgroundColor: "rgba(12,13,17,0.97)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  modalTitleInput: { color: "#fff", fontSize: 15, fontWeight: "800", fontFamily: fontFamilyForWeight(800), padding: 0 },
  modalBodyInput: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, lineHeight: 18, padding: 0, minHeight: 60, textAlignVertical: "top" },
  sectionLabel: { color: "rgba(238,241,246,0.45)", fontSize: 9.5, fontWeight: "900", fontFamily: fontFamilyForWeight(900), letterSpacing: 1 },
  fieldName: { color: "rgba(238,241,246,0.7)", fontSize: 11, fontWeight: "700", fontFamily: fontFamilyForWeight(700), maxWidth: 110 },
  fieldInput: { flex: 1, color: "#fff", fontSize: 11.5, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", paddingHorizontal: 9, paddingVertical: 6 },
  quickChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  quickChipText: { color: "rgba(238,241,246,0.75)", fontSize: 10.5, fontWeight: "700", fontFamily: fontFamilyForWeight(700) },
}));
