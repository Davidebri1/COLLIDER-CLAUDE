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
import { useCollider } from "../state";
import { Glass } from "../components/Glass";
import { Page } from "../components/Page";
import { styles, withFont } from "../styles/theme";
import { CATEGORIES, modelById } from "../models";
import { SearchBar, useSearch, ConsensusRunCard } from "../features";
import { SelectionBar, SelectModeToggle, SelectDot } from "../components/SelectionBar";

export function HistoryScreen({ goBack, openCard, modelId }: { goBack: () => void; openCard: (id: string) => void; modelId?: string }) {
  const { state, dispatch } = useCollider();
  const [tab, setTab] = useState<"convos" | "consensus">("convos");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Card view opens History scoped to its own model — only conversations
  // that are Qwen-and-only-Qwen (not shared multi-model runs this model
  // merely participated in) show up here, and picking one loads it into
  // this model's own conversation pointer, not the shared one.
  const scopedModel = modelId ? modelById(modelId) : undefined;
  const scopedConversations = modelId
    ? state.conversations.filter((c) => {
        const modelsInConv = Object.keys(c.threads).filter((mid) => (c.threads[mid] || []).length > 0);
        return modelsInConv.length === 1 && modelsInConv[0] === modelId;
      })
    : state.conversations;
  const convSearch = useSearch(scopedConversations, (c) => `${c.title} ${c.tab}`);
  const consSearch = useSearch(state.consensusRuns, (r) => `${r.prompt} ${r.verdict}`);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const handleBulkDelete = () => {
    dispatch({ type: tab === "convos" ? "removeConversations" : "removeConsensuses", ids: Array.from(selectedIds) } as any);
    exitSelectMode();
  };
  // Selection is per-tab — switching tabs with a stale selection referencing
  // the other kind's ids would silently no-op the delete.
  const switchTab = (t: "convos" | "consensus") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(t);
    exitSelectMode();
  };
  const activeList = tab === "convos" ? convSearch.filtered : consSearch.filtered;

  // Was a per-category rainbow (blue/lavender/violet/pink/mint) — same call as
  // GlobalSearch/InlineSearch's KIND_META: category is already named in the
  // label, so the color was decorative only. Flattened to one neutral.
  const getCategoryColor = (_cat: string) => "#e2e8f0";

  const getCategoryLabel = (cat: string) => {
    const found = CATEGORIES.find(c => c.id === cat);
    return found ? found.label : cat;
  };

  return (
    <Page title={scopedModel ? `${scopedModel.label} History` : "History Logs"} goBack={goBack}>
      <View style={{ flex: 1, backgroundColor: "#06040a" }}>

        {/* Glass Navigation Segment switcher — Consensus is a cross-model
            concept (it scores multiple models against each other), so it
            makes no sense inside a single model's scoped history. */}
        {!scopedModel && (
          <View style={localStyles.tabContainer}>
            <Pressable
              onPress={() => switchTab("convos")}
              style={[localStyles.navTab, tab === "convos" && localStyles.navTabActive]}
            >
              <Text style={[localStyles.navTabText, tab === "convos" && localStyles.navTabTextActive]}>
                CONVERSATIONS ({scopedConversations.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchTab("consensus")}
              style={[localStyles.navTab, tab === "consensus" && localStyles.navTabActive]}
            >
              <Text style={[localStyles.navTabText, tab === "consensus" && localStyles.navTabTextActive]}>
                CONSENSUS COGNITION ({state.consensusRuns.length})
              </Text>
            </Pressable>
          </View>
        )}

        {/* Select-mode toggle + bulk action bar */}
        <View style={{ paddingHorizontal: 12, marginTop: scopedModel ? 10 : 0, marginBottom: 10, flexDirection: "row", justifyContent: "flex-end" }}>
          <SelectModeToggle active={selectMode} onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))} />
        </View>
        <SelectionBar
          count={selectedIds.size}
          total={activeList.length}
          onSelectAll={() => setSelectedIds(selectedIds.size >= activeList.length ? new Set() : new Set(activeList.map((i: any) => i.id)))}
          onClear={exitSelectMode}
          onDelete={handleBulkDelete}
        />

        {tab === "convos" ? (
          <>
            {/* Search Bar */}
            <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
              <View style={localStyles.searchContainer}>
                <Ionicons name="search" size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
                <TextInput
                  value={convSearch.q}
                  onChangeText={convSearch.setQ}
                  placeholder="Search titles or model tags..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={localStyles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {convSearch.q.length > 0 && (
                  <Pressable onPress={() => convSearch.setQ("")} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Conversations list scroll */}
            <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 10 }} showsVerticalScrollIndicator={false}>
              {convSearch.filtered.length === 0 ? (
                <View style={localStyles.emptyContainer}>
                  <Ionicons name="chatbubbles-outline" size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
                  <Text style={styles.muted}>
                    {convSearch.q ? "No conversations match your search." : "No conversations yet. Create one in the workspace."}
                  </Text>
                </View>
              ) : (
                convSearch.filtered.map((conv) => {
                  // Scoped view: badge the model itself (in its own color)
                  // instead of the category — "GENERAL" told you nothing
                  // useful when every card here is already Qwen-only.
                  const borderAccent = scopedModel ? scopedModel.color : getCategoryColor(conv.tab);
                  const badgeLabel = scopedModel ? scopedModel.label.toUpperCase() : getCategoryLabel(conv.tab).toUpperCase();
                  const isSelected = selectedIds.has(conv.id);
                  return (
                    <Pressable
                      key={conv.id}
                      onPress={() => {
                        if (selectMode) { toggleSelected(conv.id); return; }
                        if (modelId) {
                          // Local to this model only — the shared multi-model
                          // pointer (and every other model's card) is untouched.
                          dispatch({ type: "loadConversationForModel", modelId, id: conv.id });
                          openCard(modelId);
                          return;
                        }
                        dispatch({ type: "loadConversation", category: conv.tab, id: conv.id });
                        const first = Object.keys(conv.threads)[0];
                        if (first) openCard(first);
                      }}
                      onLongPress={() => { if (!selectMode) setSelectMode(true); toggleSelected(conv.id); }}
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {selectMode && <SelectDot selected={isSelected} />}
                      <Glass isCard style={[localStyles.convoCard, { flex: 1 }, isSelected && { borderColor: "rgba(255,255,255,0.5)" }]}>
                        {/* Left border highlight */}
                        <View style={[localStyles.cardAccent, { backgroundColor: borderAccent }]} />
                        
                        <View style={{ flex: 1, padding: 12, gap: 6 }}>
                          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }} numberOfLines={1}>
                            {conv.title || "Untitled Conversation"}
                          </Text>
                          
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <View style={[localStyles.catBadge, { backgroundColor: `${borderAccent}15`, borderColor: `${borderAccent}30` }]}>
                                <Text style={[localStyles.catBadgeText, { color: borderAccent }]}>{badgeLabel}</Text>
                              </View>
                              {!scopedModel && (
                                <Text style={localStyles.metaText}>
                                  {Object.keys(conv.threads).length} models
                                </Text>
                              )}
                            </View>
                            <Text style={localStyles.dateText}>{new Date(conv.createdAt).toLocaleDateString()}</Text>
                          </View>
                        </View>
                      </Glass>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </>
        ) : (
          <>
            {/* Search Bar */}
            <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
              <View style={localStyles.searchContainer}>
                <Ionicons name="search" size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
                <TextInput
                  value={consSearch.q}
                  onChangeText={consSearch.setQ}
                  placeholder="Search consensus query history..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={localStyles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {consSearch.q.length > 0 && (
                  <Pressable onPress={() => consSearch.setQ("")} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Consensus cards scroll */}
            <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, gap: 10 }} showsVerticalScrollIndicator={false}>
              {consSearch.filtered.length === 0 ? (
                <View style={localStyles.emptyContainer}>
                  <Ionicons name="shield-checkmark-outline" size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
                  <Text style={styles.muted}>
                    {consSearch.q ? "No consensus runs match your search." : "No consensus runs archived yet."}
                  </Text>
                </View>
              ) : (
                consSearch.filtered.map((run) => {
                  const isSelected = selectedIds.has(run.id);
                  return (
                    <View key={run.id} style={{ flexDirection: "row", alignItems: "center" }}>
                      {selectMode && (
                        <Pressable onPress={() => toggleSelected(run.id)} style={{ paddingRight: 4 }}>
                          <SelectDot selected={isSelected} />
                        </Pressable>
                      )}
                      <View style={{ flex: 1 }} pointerEvents={selectMode ? "none" : "auto"}>
                        <ConsensusRunCard
                          run={run}
                          onOpen={() => dispatch({ type: "category", category: run.category })}
                          onDelete={() => {
                            dispatch({ type: "removeConsensus", id: run.id });
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          }}
                        />
                      </View>
                      {selectMode && (
                        <Pressable
                          onPress={() => toggleSelected(run.id)}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </>
        )}
      </View>
    </Page>
  );
}

// See RemindersScreen.tsx for why withFont is required here: without it,
// fontWeight 700+ resolves to synthetic faux-bold instead of the real
// static Manrope Bold/ExtraBold file.
const localStyles = StyleSheet.create(withFont({
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    marginVertical: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 3,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)"
  },
  navTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center"
  },
  navTabActive: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  navTabText: {
    fontSize: 9,
    color: "#6b6478",
    fontWeight: "800",
    letterSpacing: 0.5
  },
  navTabTextActive: {
    color: "#fff",
  },
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
  emptyContainer: {
    paddingVertical: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  convoCard: {
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    padding: 0,
  },
  cardAccent: {
    width: 4,
    height: "100%",
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 8,
    fontWeight: "800",
  },
  metaText: {
    color: "#858091",
    fontSize: 9.5,
  },
  dateText: {
    color: "#6b6478",
    fontSize: 9.5,
  },
}));
