import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  LayoutAnimation
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCollider, newId, type Artifact } from "../state";
import { Glass } from "../components/Glass";
import { Page } from "../components/Page";
import { styles, withFont } from "../styles/theme";
import { useSearch } from "../features";
import { useToast } from "../components/Toast";
import { SelectionBar, SelectModeToggle, SelectDot } from "../components/SelectionBar";
import { ArtifactEditModal } from "../../App";

const KIND_OPTIONS: Artifact["kind"][] = ["timeline", "statement", "document", "custom"];

function kindColor(kind: Artifact["kind"]) {
  if (kind === "timeline") return "#5dbdff";
  if (kind === "statement") return "#ffb74d";
  if (kind === "document") return "#e2e8f0";
  return "#6b6478";
}

export function ArtifactsScreen({ goBack }: { goBack: () => void }) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Artifact["kind"]>("custom");
  const [editingArtifact, setEditingArtifact] = useState<Artifact | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { q, setQ, filtered } = useSearch(state.artifacts, (a) => `${a.title} ${a.content} ${a.kind}`);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const handleBulkDelete = () => {
    dispatch({ type: "removeArtifacts", ids: Array.from(selectedIds) });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    exitSelectMode();
  };

  const handleAddArtifact = () => {
    const id = newId("art");
    const modelId = state.selectedModelIds[state.activeCategory]?.[0] || "global";
    const artTitle = title.trim() || "New Artifact";
    dispatch({ type: "artifact", id, title: artTitle, content: "", kind, modelId, fingerprint: id });
    setTitle("");
    setEditingArtifact({ id, title: artTitle, content: "", kind, modelId, ts: Date.now() } as Artifact);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const handleDeleteArtifact = (id: string) => {
    dispatch({ type: "removeArtifact", id });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  return (
    <Page title="Artifacts" goBack={goBack}>
      <View style={{ flex: 1, backgroundColor: "#06040a" }}>

        {/* Select-mode toggle + bulk action bar */}
        <View style={{ paddingHorizontal: 12, marginTop: 8, flexDirection: "row", justifyContent: "flex-end" }}>
          <SelectModeToggle active={selectMode} onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))} />
        </View>
        <SelectionBar
          count={selectedIds.size}
          total={filtered.length}
          onSelectAll={() => setSelectedIds(selectedIds.size >= filtered.length ? new Set() : new Set(filtered.map((a) => a.id)))}
          onClear={exitSelectMode}
          onDelete={handleBulkDelete}
        />

        {/* Search Bar */}
        <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
          <View style={localStyles.searchContainer}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search artifacts..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={localStyles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Quick Add Artifact Box */}
        <View style={{ paddingHorizontal: 12, marginVertical: 8, gap: 8 }}>
          <View style={localStyles.addBox}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="New artifact title (timeline, statement, document...)"
              placeholderTextColor="rgba(255,255,255,0.25)"
              style={localStyles.addInput}
            />
            <Pressable
              onPress={handleAddArtifact}
              style={localStyles.addButton}
            >
              <Ionicons name="add" size={18} color="#e2e8f0" />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {KIND_OPTIONS.map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[
                  localStyles.kindChip,
                  kind === k && { backgroundColor: `${kindColor(k)}22`, borderColor: `${kindColor(k)}66` },
                ]}
              >
                <Text
                  style={[
                    localStyles.kindChipText,
                    kind === k && {
                      color: kindColor(k),
                      textShadowColor: kindColor(k),
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 6,
                    },
                  ]}
                >
                  {k.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Scrollable list */}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 10 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={localStyles.emptyContainer}>
              <Ionicons name="layers-outline" size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
              <Text style={styles.muted}>
                {q ? "No artifacts match your search." : "No artifacts yet. Smart Gen auto-generates timelines, statements, and documents from your chats."}
              </Text>
            </View>
          ) : (
            filtered.map((a) => {
              const accentColor = kindColor(a.kind);
              const isSelected = selectedIds.has(a.id);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => (selectMode ? toggleSelected(a.id) : setEditingArtifact(a))}
                  onLongPress={() => { if (!selectMode) setSelectMode(true); toggleSelected(a.id); }}
                  style={{ flexDirection: "row", alignItems: "center" }}
                >
                  {selectMode && <SelectDot selected={isSelected} />}
                  <Glass style={[localStyles.card, { flex: 1 }, isSelected && { borderColor: "rgba(255,255,255,0.5)" }]}>
                    <View style={[localStyles.cardAccent, { backgroundColor: accentColor }]} />
                    <View style={localStyles.cardContent}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={[localStyles.kindBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}35` }]}>
                          <Text style={[localStyles.kindBadgeText, { color: accentColor }]}>{a.kind.toUpperCase()}</Text>
                        </View>
                        <Text style={[styles.bodyText, { fontSize: 13, fontWeight: "700", color: "#fff", flex: 1 }]} numberOfLines={1}>
                          {a.title}
                        </Text>
                      </View>
                      <Text style={[styles.bodyText, { fontSize: 12, lineHeight: 17, color: "rgba(255,255,255,0.7)", marginTop: 6 }]} numberOfLines={3}>
                        {a.content || "(empty — tap to add content)"}
                      </Text>
                      <View style={localStyles.cardFooter}>
                        <Text style={localStyles.dateText}>{new Date(a.ts).toLocaleDateString()}</Text>
                        <Pressable hitSlop={8} onPress={() => handleDeleteArtifact(a.id)} style={localStyles.deleteButton}>
                          <Ionicons name="trash-outline" size={13} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  </Glass>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      {editingArtifact && (
        <ArtifactEditModal
          visible={!!editingArtifact}
          item={editingArtifact}
          dispatch={dispatch}
          state={state}
          onClose={() => setEditingArtifact(null)}
          onSave={(updated) => {
            dispatch({ type: "updateArtifact", artifact: updated });
            setEditingArtifact(null);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }}
          onDelete={(id) => {
            dispatch({ type: "removeArtifact", id });
            setEditingArtifact(null);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }}
        />
      )}
    </Page>
  );
}

// See RemindersScreen.tsx for why withFont is required here: without it,
// fontWeight 700+ resolves to synthetic faux-bold instead of the real
// static Manrope Bold/ExtraBold file.
const localStyles = StyleSheet.create(withFont({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 12,
    height: "100%",
    padding: 0
  },
  addBox: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
    alignItems: "center",
    gap: 8,
  },
  addInput: {
    flex: 1,
    color: "#fff",
    fontSize: 12.5,
    minHeight: 28,
    maxHeight: 60,
    padding: 0,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#e2e8f0",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  kindChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  kindChipText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#fff",
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(18,18,22,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    padding: 0,
  },
  cardAccent: {
    width: 4,
    height: "100%",
  },
  cardContent: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  kindBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  kindBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  dateText: {
    color: "#6b6478",
    fontSize: 9.5,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
}));
