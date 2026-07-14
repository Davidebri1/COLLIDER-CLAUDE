// Global search across everything Smart Gen tracks: conversations, memories,
// reminders, projects, artifacts — with type + model filters. Opened from the
// grid toolbar; tapping a result navigates to the screen that owns it.
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCollider } from "../state";
import { modelById, MODELS } from "../models";
import { styles, SCREEN_W } from "../styles/theme";
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

const KIND_META: Record<ResultKind, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  conversation: { label: "Conversation", icon: "time-outline", color: "#5dbdff" },
  memory: { label: "Memory", icon: "extension-puzzle-outline", color: "#a78bfa" },
  reminder: { label: "Reminder", icon: "alarm-outline", color: "#a78bfa" },
  project: { label: "Project", icon: "briefcase-outline", color: "#4be6b1" },
  artifact: { label: "Artifact", icon: "layers-outline", color: "#ff8a65" },
};

export function GlobalSearch({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (screen: Result["screen"]) => void;
}) {
  const { state } = useCollider();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ResultKind>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  const allResults = useMemo<Result[]>(() => {
    const out: Result[] = [];
    for (const conv of state.conversations) {
      const allText = Object.values(conv.threads).flat().map((m) => m.content).join(" ");
      out.push({
        kind: "conversation",
        id: conv.id,
        title: conv.title || "Untitled conversation",
        subtitle: allText.slice(0, 80),
        screen: "history",
      });
    }
    for (const m of state.memories) {
      out.push({ kind: "memory", id: m.id, title: m.content.slice(0, 60), subtitle: m.tags?.join(", ") || "", modelId: m.modelId, screen: "memory" });
    }
    for (const r of state.reminders) {
      out.push({ kind: "reminder", id: r.id, title: r.title, subtitle: r.due ? new Date(r.due).toLocaleDateString() : "", modelId: r.modelId, screen: "reminders" });
    }
    for (const p of state.projects) {
      out.push({ kind: "project", id: p.id, title: p.name, subtitle: `${p.tasks.length} tasks`, modelId: p.modelId, screen: "projects" });
    }
    for (const a of state.artifacts) {
      out.push({ kind: "artifact", id: a.id, title: a.title, subtitle: a.kind, modelId: a.modelId, screen: "artifacts" });
    }
    return out;
  }, [state.conversations, state.memories, state.reminders, state.projects, state.artifacts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allResults.filter((r) => {
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (modelFilter !== "all" && r.modelId !== modelFilter) return false;
      if (!needle) return true;
      return r.title.toLowerCase().includes(needle) || r.subtitle.toLowerCase().includes(needle);
    });
  }, [allResults, q, typeFilter, modelFilter]);

  const modelOptions = [{ label: "All models", value: "all" }, ...MODELS.map((m) => ({ label: m.label, value: m.id }))];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}>
        <LinearGradient colors={["#151518", "#08080a"]} style={{ flex: 1, paddingTop: 54 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Search Everything</Text>
            <Pressable onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Ionicons name="search" size={15} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search conversations, memories, reminders…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{ flex: 1, color: "#fff", fontSize: 13 }}
              autoFocus
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")}><Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.4)" /></Pressable>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 10 }} style={{ flexGrow: 0 }}>
            {(["all", "conversation", "memory", "reminder", "project", "artifact"] as const).map((k) => {
              const active = typeFilter === k;
              const meta = k === "all" ? null : KIND_META[k];
              return (
                <Pressable
                  key={k}
                  onPress={() => setTypeFilter(k)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                    backgroundColor: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    borderWidth: 1, borderColor: active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  <Text style={{ color: active ? "#fff" : "#6b6478", fontSize: 11, fontWeight: "700" }}>
                    {k === "all" ? "All" : meta!.label + "s"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, gap: 6 }}>
            <Ionicons name="filter-outline" size={12} color="#6b6478" />
            <Picker value={modelFilter} onChange={setModelFilter} options={modelOptions} textStyle={{ fontSize: 11, color: "#6b6478" }} />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            {filtered.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 60 }}>
                <Ionicons name="search-outline" size={28} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
                <Text style={{ color: "#6b6478", fontSize: 12 }}>No results found.</Text>
              </View>
            ) : (
              filtered.map((r) => {
                const meta = KIND_META[r.kind];
                const model = r.modelId ? modelById(r.modelId) : undefined;
                return (
                  <Pressable
                    key={`${r.kind}_${r.id}`}
                    onPress={() => { onNavigate(r.screen); onClose(); }}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12,
                      padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: `${meta.color}22`, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={meta.icon} size={15} color={meta.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{r.title}</Text>
                      <Text style={{ color: "#6b6478", fontSize: 10.5, marginTop: 2 }} numberOfLines={1}>
                        {meta.label}{model ? ` · ${model.label}` : ""}{r.subtitle ? ` · ${r.subtitle}` : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.25)" />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}
