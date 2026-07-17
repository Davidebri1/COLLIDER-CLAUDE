// Persistent, always-visible search bar for the global view — replaces the
// old full-screen search modal. Same underlying data (conversations,
// memories, reminders, projects, artifacts) and filters (type, model), just
// docked inline instead of taking over the screen. Results drop down below
// the bar only while there's an active query.
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCollider } from "../state";
import { modelById, MODELS } from "../models";
import { Picker } from "./Picker";

type ResultKind = "conversation" | "memory" | "reminder" | "project" | "artifact";
type Result = {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string;
  modelId?: string;
  screen: "history" | "memory" | "reminders" | "projects" | "artifacts";
};

// See GlobalSearch.tsx — same reasoning: icon + label already distinguish
// kind, so color here was decorative only. Black & white palette.
const KIND_META: Record<ResultKind, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  conversation: { label: "Conversation", icon: "time-outline", color: "#ffffff" },
  memory: { label: "Memory", icon: "extension-puzzle-outline", color: "#ffffff" },
  reminder: { label: "Reminder", icon: "alarm-outline", color: "#ffffff" },
  project: { label: "Project", icon: "briefcase-outline", color: "#ffffff" },
  artifact: { label: "Artifact", icon: "layers-outline", color: "#ffffff" },
};

export function InlineSearch({ onNavigate }: { onNavigate: (screen: Result["screen"]) => void }) {
  const { state } = useCollider();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ResultKind>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const allResults = useMemo<Result[]>(() => {
    const out: Result[] = [];
    for (const conv of state.conversations || []) {
      const allText = Object.values(conv.threads || {}).flat().map((m: any) => m.content).join(" ");
      out.push({ kind: "conversation", id: conv.id, title: conv.title || "Untitled conversation", subtitle: allText.slice(0, 80), screen: "history" });
    }
    for (const m of state.memories || []) out.push({ kind: "memory", id: m.id, title: m.content.slice(0, 60), subtitle: m.tags?.join(", ") || "", modelId: m.modelId, screen: "memory" });
    for (const r of state.reminders || []) out.push({ kind: "reminder", id: r.id, title: r.title, subtitle: r.due ? new Date(r.due).toLocaleDateString() : "", modelId: r.modelId, screen: "reminders" });
    for (const p of state.projects || []) out.push({ kind: "project", id: p.id, title: p.name, subtitle: `${p.tasks.length} tasks`, modelId: p.modelId, screen: "projects" });
    for (const a of state.artifacts || []) out.push({ kind: "artifact", id: a.id, title: a.title, subtitle: a.kind, modelId: a.modelId, screen: "artifacts" });
    return out;
  }, [state.conversations, state.memories, state.reminders, state.projects, state.artifacts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle && typeFilter === "all" && modelFilter === "all") return [];
    return allResults.filter((r) => {
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (modelFilter !== "all" && r.modelId !== modelFilter) return false;
      if (!needle) return true;
      return r.title.toLowerCase().includes(needle) || r.subtitle.toLowerCase().includes(needle);
    });
  }, [allResults, q, typeFilter, modelFilter]);

  const modelOptions = [{ label: "All", value: "all" }, ...MODELS.map((m) => ({ label: m.label, value: m.id }))];
  const typeOptions: { label: string; value: "all" | ResultKind }[] = [
    { label: "All", value: "all" },
    { label: "Conversation History", value: "conversation" },
    { label: "Memories", value: "memory" },
    { label: "Reminders", value: "reminder" },
    { label: "Projects", value: "project" },
    { label: "Artifacts", value: "artifact" },
  ];
  // Only pop the tray when there's something to actually show — a filter
  // change with zero matches used to render a big "No results found" box,
  // which read as an error state for what's meant to be a lightweight,
  // streaming results dropdown, not a search with a failure mode.
  const open = filtered.length > 0;

  return (
    <View style={{ marginBottom: 6, position: "relative", zIndex: 40 }}>
      {/* One row. A sliver, not a block — no title line above it, no
          second row of filter fields below it. Type/Model filters live in
          this same row as small icon triggers with a lit dot when active,
          not full "Type: All" / "Model: All" text boxes that doubled the
          bar's height for information that's rarely non-default. */}
      {/* Same weight as the CATEGORY/MODELS chips below it (thin border, no
          shadow) — it was previously bordered/shadowed more heavily than
          any other secondary control on screen, which made a rarely-used
          utility the most visually loud thing under the title. */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", height: 34, borderRadius: 12,
          backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
          paddingHorizontal: 10, gap: 8,
        }}
      >
        <Ionicons name="search" size={13} color="rgba(255,255,255,0.5)" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search everything…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={{ flex: 1, color: "#fff", fontSize: 12 }}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.4)" />
          </Pressable>
        )}
        <View style={{ width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.14)" }} />
        <Pressable onPress={() => setTypePickerOpen(true)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Ionicons name="list-outline" size={14} color={typeFilter !== "all" ? "#ffffff" : "rgba(255,255,255,0.5)"} />
          {typeFilter !== "all" && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#ffb74d" }} />}
        </Pressable>
        <Pressable onPress={() => setModelPickerOpen(true)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Ionicons name="filter-outline" size={14} color={modelFilter !== "all" ? "#ffffff" : "rgba(255,255,255,0.5)"} />
          {modelFilter !== "all" && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#ffb74d" }} />}
        </Pressable>
      </View>

      <Picker
        hideTrigger
        controlledOpen={typePickerOpen}
        onRequestClose={() => setTypePickerOpen(false)}
        value={typeFilter}
        onChange={(v) => { setTypeFilter(v as any); setTypePickerOpen(false); }}
        options={typeOptions}
      />
      <Picker
        hideTrigger
        controlledOpen={modelPickerOpen}
        onRequestClose={() => setModelPickerOpen(false)}
        value={modelFilter}
        onChange={(v) => { setModelFilter(v as string); setModelPickerOpen(false); }}
        options={modelOptions}
      />

      {open && (
        <View style={{ marginTop: 6, maxHeight: 320, borderRadius: 14, backgroundColor: "#0a0a0a", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {filtered.slice(0, 20).map((r) => {
                const meta = KIND_META[r.kind];
                const model = r.modelId ? modelById(r.modelId) : undefined;
                return (
                  <Pressable
                    key={`${r.kind}_${r.id}`}
                    onPress={() => { onNavigate(r.screen); setQ(""); setTypeFilter("all"); setModelFilter("all"); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: `${meta.color}22`, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={meta.icon} size={13} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{r.title}</Text>
                      <Text style={{ color: "#6b6478", fontSize: 10, marginTop: 1 }} numberOfLines={1}>
                        {meta.label}{model ? ` · ${model.label}` : ""}{r.subtitle ? ` · ${r.subtitle}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
