import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Platform,
  LayoutAnimation
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useCollider } from "../state";
import { Glass } from "../components/Glass";
import { styles, SCREEN_W, withFont } from "../styles/theme";
import { MODELS, modelById } from "../models";
import { useToast } from "../components/Toast";

export function AgentSkillsDrawer({
  visible,
  onClose,
  openUpgrade,
}: {
  visible: boolean;
  onClose: () => void;
  openUpgrade: () => void;
}) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"agents" | "instructions" | "skills">("skills");

  // Custom Agent Form State
  const [agentName, setAgentName] = useState("");
  const [selectedModel, setSelectedModel] = useState("free/qwen-coder-32b");
  const [agentInstructions, setAgentInstructions] = useState("");

  const handleCreateAgent = () => {
    if (!agentName.trim() || !agentInstructions.trim()) {
      toast("Please fill in all fields.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    dispatch({
      type: "addCustomAgent",
      agent: {
        name: agentName.trim(),
        modelId: selectedModel,
        instructions: agentInstructions.trim(),
      },
    });
    setAgentName("");
    setAgentInstructions("");
    toast(`Custom agent "${agentName}" created successfully!`);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const codingModels = MODELS.filter((m) => m.category.includes("coding"));
  
  const availableSkills = [
    { id: "accidental-data-loss-prevention", name: "Accidental Data Loss Prevention", desc: "Verifies Drop, Truncate, or broad Delete SQL statements." },
    { id: "dbt-bigquery", name: "dbt BigQuery Compiler", desc: "Injects dbt analytics compile structures." },
    { id: "ml-best-practices", name: "ML Best Practices", desc: "Forces statistical validation criteria on regression/clustering." },
    { id: "gcp-composer-troubleshooting", name: "GCP Composer Diagnostics", desc: "Airflow DAG debugging and Root Cause Analysis." },
    { id: "dataform-bigquery", name: "Dataform Pipeline Compiler", desc: "Configures dataform workflow sqlx pipelines." },
  ];

  const hasPro = state.tier === "pro" || state.tier === "elite";
  const hasElite = state.tier === "elite";

  const getModelColor = (modelId?: string) => {
    const found = modelById(modelId || "");
    return found ? found.color : "#e2e8f0";
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <LinearGradient 
          colors={["#130e20", "#08060d"]} 
          style={[styles.editSheet, { width: SCREEN_W - 20, marginTop: 44, maxHeight: "88%", padding: 0, borderRadius: 24 }]} 
          onStartShouldSetResponder={() => true}
        >
          {/* Header Title */}
          <View style={localStyles.drawerHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="settings" size={16} color="#e2e8f0" />
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 1.5 }}>CONSOLE CONTROL</Text>
            </View>
            <Pressable onPress={onClose} style={localStyles.closeBtn}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>

          {/* Sub Tab Switcher */}
          <View style={localStyles.tabContainer}>
            {(["skills", "agents", "instructions"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setActiveTab(tab);
                }}
                style={[
                  localStyles.navTab,
                  activeTab === tab && localStyles.navTabActive
                ]}
              >
                <Text style={[
                  localStyles.navTabText,
                  activeTab === tab && localStyles.navTabTextActive
                ]}>
                  {tab === "agents" ? "AGENTS" : tab === "skills" ? "SKILLS" : "RULES"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Content Pane */}
          <View style={{ flex: 1, position: "relative" }}>
            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              
              {/* Skills Tab Panel */}
              {activeTab === "skills" && (
                <View style={{ gap: 14 }}>
                  <View style={localStyles.infoBox}>
                    <Text style={localStyles.infoBoxTitle}>COMPILE SPECIALIZED SKILLS</Text>
                    <Text style={localStyles.infoBoxDesc}>
                      Bind specialized data transformations and safety checkpoints directly into model contexts.
                    </Text>
                  </View>
                  
                  <View style={{ gap: 8 }}>
                    {availableSkills.map((sk) => {
                      const active = state.activeSkills?.includes(sk.id) || false;
                      return (
                        <Pressable
                          key={sk.id}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            dispatch({ type: "toggleSkill", skillId: sk.id });
                          }}
                          style={[
                            localStyles.skillCard,
                            active && localStyles.skillCardActive
                          ]}
                        >
                          <View style={{ flex: 1, marginRight: 10, gap: 2 }}>
                            <Text style={[
                              localStyles.skillName,
                              active && { color: "#e2e8f0" }
                            ]}>
                              {sk.name}
                            </Text>
                            <Text style={localStyles.skillDesc}>{sk.desc}</Text>
                          </View>
                          <Ionicons
                            name={active ? "checkbox" : "square-outline"}
                            size={18}
                            color={active ? "#e2e8f0" : "#6b6478"}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Custom Agent Creator Tab */}
              {activeTab === "agents" && (
                <View style={{ gap: 14 }}>
                  <View style={localStyles.infoBox}>
                    <Text style={localStyles.infoBoxTitle}>SYNTHESIZE SPECIAL AGENT</Text>
                    <Text style={localStyles.infoBoxDesc}>
                      Assemble customized agent roles with targeted system instructions and base code models.
                    </Text>
                  </View>
                  
                  <View style={{ gap: 4 }}>
                    <Text style={localStyles.formLabel}>AGENT NAME</Text>
                    <TextInput
                      value={agentName}
                      onChangeText={setAgentName}
                      placeholder="e.g. Postgres Architect"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      style={localStyles.formInput}
                    />
                  </View>

                  <View style={{ gap: 4 }}>
                    <Text style={localStyles.formLabel}>BASE MODEL ENGINE</Text>
                    <View style={localStyles.modelScroller}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {codingModels.map((m) => {
                          const isSelected = selectedModel === m.id;
                          return (
                            <Pressable
                              key={m.id}
                              onPress={() => setSelectedModel(m.id)}
                              style={[
                                localStyles.modelBtn,
                                isSelected && { backgroundColor: `${m.color}15`, borderColor: m.color, borderWidth: 1 }
                              ]}
                            >
                              <View style={[localStyles.modelDot, { backgroundColor: m.color }]} />
                              <Text style={[
                                localStyles.modelBtnText,
                                isSelected && { color: m.color, fontWeight: "900" }
                              ]}>
                                {m.short.toUpperCase()}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>

                  <View style={{ gap: 4 }}>
                    <Text style={localStyles.formLabel}>ROLE & SYSTEM INSTRUCTIONS</Text>
                    <TextInput
                      value={agentInstructions}
                      onChangeText={setAgentInstructions}
                      placeholder="Instruct this agent's strict behaviors, formatting rules, and boundaries..."
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      multiline
                      numberOfLines={4}
                      style={localStyles.formTextarea}
                    />
                  </View>

                  <Pressable onPress={handleCreateAgent} style={localStyles.submitBtn}>
                    <Text style={{ color: "#000", fontWeight: "900", fontSize: 11.5, letterSpacing: 1 }}>
                      SYNTHESIZE AGENT
                    </Text>
                  </Pressable>

                  {/* Active Agents list */}
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <Text style={localStyles.boardHeader}>ACTIVE CUSTOM CONSOLE AGENTS ({state.customAgents?.length || 0})</Text>
                    {!state.customAgents || state.customAgents.length === 0 ? (
                      <Text style={styles.muted}>No custom agents created yet.</Text>
                    ) : (
                      state.customAgents.map((ag) => {
                        const mColor = getModelColor(ag.modelId);
                        return (
                          <View key={ag.id} style={localStyles.activeAgentCard}>
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12.5 }}>{ag.name}</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <View style={[localStyles.modelDot, { backgroundColor: mColor, width: 4, height: 4 }]} />
                                <Text style={{ color: "#858091", fontSize: 9.5 }}>{modelById(ag.modelId)?.label || ag.modelId}</Text>
                              </View>
                              <Text style={{ color: "#6b6478", fontSize: 10.5 }} numberOfLines={1}>{ag.instructions}</Text>
                            </View>
                            <Pressable 
                              onPress={() => {
                                dispatch({ type: "removeCustomAgent", id: ag.id });
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              }} 
                              style={localStyles.trashBtn}
                            >
                              <Ionicons name="trash-outline" size={13} color="#ef4444" />
                            </Pressable>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              )}

              {/* System Instructions / Rules Tab */}
              {activeTab === "instructions" && (
                <View style={{ gap: 14 }}>
                  <View style={localStyles.infoBox}>
                    <Text style={localStyles.infoBoxTitle}>GLOBAL COGNITION RULES</Text>
                    <Text style={localStyles.infoBoxDesc}>
                      Establish global directive templates that inject system instructions into every conversational thread.
                    </Text>
                  </View>
                  
                  <TextInput
                    value={state.customInstructions}
                    onChangeText={(val) => dispatch({ type: "setCustomInstructions", value: val })}
                    placeholder="e.g. Always write typescript code, output items in clean Markdown lists, write comments in documentation style..."
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    multiline
                    numberOfLines={6}
                    style={localStyles.formTextareaBig}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="checkmark-circle-outline" size={12} color="#10b981" />
                    <Text style={{ color: "#10b981", fontSize: 10.5, fontWeight: "600" }}>Directives auto-save in real-time</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Frost locked layers for Pro features */}
            {activeTab === "agents" && !hasPro && (
              <View style={localStyles.lockedOverlay}>
                <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={localStyles.lockedContent}>
                  <Ionicons name="lock-closed" size={32} color="#e2e8f0" style={{ marginBottom: 12 }} />
                  <Text style={localStyles.lockHeader}>PRO ACCOUNT REQUIRED</Text>
                  <Text style={localStyles.lockDesc}>
                    Custom role creation is unlocked for Pro or Elite subscription tiers.
                  </Text>
                  <Pressable 
                    onPress={() => { onClose(); openUpgrade(); }} 
                    style={localStyles.lockUpgradeBtn}
                  >
                    <Text style={localStyles.lockUpgradeText}>UPGRADE TO UNLOCK</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {activeTab === "instructions" && !hasPro && (
              <View style={localStyles.lockedOverlay}>
                <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={localStyles.lockedContent}>
                  <Ionicons name="lock-closed" size={32} color="#e2e8f0" style={{ marginBottom: 12 }} />
                  <Text style={localStyles.lockHeader}>PRO ACCOUNT REQUIRED</Text>
                  <Text style={localStyles.lockDesc}>
                    Custom global instruction overrides are unlocked for Pro or Elite subscription tiers.
                  </Text>
                  <Pressable 
                    onPress={() => { onClose(); openUpgrade(); }} 
                    style={localStyles.lockUpgradeBtn}
                  >
                    <Text style={localStyles.lockUpgradeText}>UPGRADE TO UNLOCK</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {activeTab === "skills" && !hasElite && (
              <View style={localStyles.lockedOverlay}>
                <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={localStyles.lockedContent}>
                  <Ionicons name="lock-closed" size={32} color="#ffb74d" style={{ marginBottom: 12 }} />
                  <Text style={[localStyles.lockHeader, { color: "#ffb74d" }]}>ELITE CONSOLE REQUIRED</Text>
                  <Text style={localStyles.lockDesc}>
                    Injecting advanced compiled developer skills (dbt, ML, GCP diagnostics) requires an Elite subscription.
                  </Text>
                  <Pressable 
                    onPress={() => { onClose(); openUpgrade(); }} 
                    style={[localStyles.lockUpgradeBtn, { backgroundColor: "#ffb74d" }]}
                  >
                    <Text style={localStyles.lockUpgradeText}>UNLOCK ELITE ENG</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Modal>
  );
}

// See RemindersScreen.tsx for why withFont is required here: without it,
// fontWeight 700+ resolves to synthetic faux-bold instead of the real
// static Manrope Bold/ExtraBold file.
const localStyles = StyleSheet.create(withFont({
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  closeBtn: {
    padding: 4,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 13,
  },
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
  infoBox: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 6,
  },
  infoBoxTitle: {
    color: "#e2e8f0",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  infoBoxDesc: {
    color: "#858091",
    fontSize: 10.5,
    lineHeight: 15,
  },
  skillCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skillCardActive: {
    borderColor: "rgba(196,181,253,0.3)",
    backgroundColor: "rgba(196,181,253,0.05)",
  },
  skillName: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  skillDesc: {
    color: "#6b6478",
    fontSize: 10.5,
    lineHeight: 14,
  },
  formLabel: {
    color: "#6b6478",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  formInput: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    height: 36,
    color: "#fff",
    fontSize: 12,
  },
  modelScroller: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "transparent",
    borderWidth: 1,
  },
  modelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  modelBtnText: {
    fontSize: 10,
    color: "#6b6478",
    fontWeight: "700",
  },
  formTextarea: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    height: 60,
    color: "#fff",
    fontSize: 12,
    textAlignVertical: "top",
  },
  formTextareaBig: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 140,
    color: "#fff",
    fontSize: 12.5,
    textAlignVertical: "top",
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: "#e2e8f0",
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  boardHeader: {
    color: "#e2e8f0",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 10,
  },
  activeAgentCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trashBtn: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    overflow: "hidden",
  },
  lockedContent: {
    flex: 1,
    backgroundColor: "rgba(13, 8, 22, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockHeader: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
  },
  lockDesc: {
    color: "#858091",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 16,
    maxWidth: 240,
  },
  lockUpgradeBtn: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
  },
  lockUpgradeText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
}));