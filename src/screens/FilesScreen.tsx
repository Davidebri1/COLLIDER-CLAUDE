import { FileEditModal } from "../../App";
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ImageBackground,
  TextInput,
  LayoutAnimation
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCollider } from "../state";
import { Glass } from "../components/Glass";
import { Page } from "../components/Page";
import { styles } from "../styles/theme";
import { MODELS } from "../models";
import { SearchBar, useSearch } from "../features";
import { SelectionBar, SelectModeToggle } from "../components/SelectionBar";

export function FilesScreen({ goBack, openOutputs }: { goBack: () => void; openOutputs?: () => void }) {
  const { state, dispatch } = useCollider();
  const [tab, setTab] = useState<"all" | "uploaded" | "generated">("all");
  const [editingFile, setEditingFile] = useState<any | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const scope = state.files.filter((f) => tab === "all" || f.kind === tab);
  const { q, setQ, filtered } = useSearch(scope, (f) => f.name);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const handleBulkDelete = () => {
    dispatch({ type: "removeFiles", ids: Array.from(selectedIds) });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    exitSelectMode();
  };

  const getFileIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif")) {
      return "image-outline";
    }
    if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".m4v") || lower.endsWith(".avi")) {
      return "videocam-outline";
    }
    if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a") || lower.endsWith(".flac")) {
      return "musical-notes-outline";
    }
    if (lower.endsWith(".json") || lower.endsWith(".js") || lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".rs") || lower.endsWith(".py")) {
      return "code-slash-outline";
    }
    return "document-text-outline";
  };

  const getModelLabel = (modelId?: string) => {
    if (!modelId) return "";
    const found = MODELS.find(x => x.id === modelId);
    return found ? found.short : modelId;
  };

  const handleAddFile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dispatch({
      type: "file",
      file: { 
        name: `collider-note-${state.files.length + 1}.txt`, 
        kind: "generated", 
        url: "local://generated" 
      },
    });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  return (
    <Page title="File Vault" goBack={goBack}>
      <View style={{ flex: 1, backgroundColor: "#06040a" }}>
        
        {/* Glass tab segment */}
        <View style={localStyles.tabContainer}>
          {(["all", "uploaded", "generated"] as const).map((t) => (
            <Pressable 
              key={t} 
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setTab(t);
              }} 
              style={[localStyles.navTab, tab === t && localStyles.navTabActive]}
            >
              <Text style={[localStyles.navTabText, tab === t && localStyles.navTabTextActive]}>
                {t === "all" ? "ALL FILES" : t.toUpperCase()} ({state.files.filter((f) => t === "all" || f.kind === t).length})
              </Text>
            </Pressable>
          ))}
          {!!openOutputs && (
            <Pressable onPress={openOutputs} style={localStyles.navTab}>
              <Text style={localStyles.navTabText}>OUTPUTS</Text>
            </Pressable>
          )}
        </View>

        {/* Select-mode toggle + bulk action bar */}
        <View style={{ paddingHorizontal: 12, flexDirection: "row", justifyContent: "flex-end" }}>
          <SelectModeToggle active={selectMode} onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))} />
        </View>
        <SelectionBar
          count={selectedIds.size}
          total={filtered.length}
          onSelectAll={() => setSelectedIds(selectedIds.size >= filtered.length ? new Set() : new Set(filtered.map((f) => f.id)))}
          onClear={exitSelectMode}
          onDelete={handleBulkDelete}
        />

        {/* Search Bar */}
        <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
          <View style={localStyles.searchContainer}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search file name..."
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

        {/* Quick Add file button */}
        <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
          <Pressable onPress={handleAddFile} style={localStyles.primaryButton}>
            <Ionicons name="add" size={16} color="#a78bfa" style={{ marginRight: 4 }} />
            <Text style={localStyles.primaryButtonText}>Add Generated Note File</Text>
          </Pressable>
        </View>

        {/* Files Grid View */}
        {filtered.length === 0 ? (
          <View style={localStyles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
            <Text style={styles.muted}>{q ? "No files match your query." : "No files saved in vault."}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {filtered.map((file) => {
                const isImage = file.name.endsWith(".png") || file.name.endsWith(".jpg") || file.url.startsWith("http");
                const iconName = getFileIcon(file.name);
                const isSelected = selectedIds.has(file.id);

                return (
                  <Pressable
                    key={file.id}
                    onPress={() => (selectMode ? toggleSelected(file.id) : setEditingFile(file))}
                    onLongPress={() => { if (!selectMode) setSelectMode(true); toggleSelected(file.id); }}
                    style={{ width: "47%", marginBottom: 12 }}
                  >
                    <Glass style={[styles.fileTile, { padding: 0, overflow: "hidden", height: 125, borderRadius: 16, borderColor: isSelected ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.08)" }]}>
                      {isImage ? (
                        <ImageBackground source={{ uri: file.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={localStyles.docPlaceholder}>
                          <Ionicons name={iconName} size={28} color="rgba(255,255,255,0.2)" />
                        </View>
                      )}
                      {selectMode && (
                        <View style={localStyles.selectCorner}>
                          <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={20} color={isSelected ? "#a78bfa" : "#fff"} />
                        </View>
                      )}

                      <View style={localStyles.tileInfoBox}>
                        <Text style={localStyles.fileName} numberOfLines={1}>{file.name}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                          <Text style={localStyles.fileKind}>{file.kind}</Text>
                          {file.modelId && (
                            <Text style={localStyles.fileModel}>{getModelLabel(file.modelId)}</Text>
                          )}
                        </View>
                      </View>
                    </Glass>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {editingFile && (
        <FileEditModal
          visible={!!editingFile}
          item={editingFile}
          onClose={() => setEditingFile(null)}
          onSave={(updated) => {
            dispatch({ type: "updateFile", file: updated });
            setEditingFile(null);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }}
          onDelete={(id) => {
            dispatch({ type: "removeFile", id });
            setEditingFile(null);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }}
        />
      )}
    </Page>
  );
}

const localStyles = StyleSheet.create({
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
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.15)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.4)",
    shadowColor: "#a78bfa",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
    height: 38,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: "#a78bfa",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  selectCorner: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  docPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  tileInfoBox: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(18,18,22,0.85)",
    padding: 8,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  fileName: {
    color: "#fff",
    fontSize: 10.5,
    fontWeight: "700",
  },
  fileKind: {
    color: "#6b6478",
    fontSize: 8.5,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  fileModel: {
    color: "#a78bfa",
    fontSize: 8.5,
    fontWeight: "700",
  },
});
