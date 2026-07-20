import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Animated, PanResponder, Modal, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useCollider, ConsensusRun, ChatMessage } from "../state";
import { Glass } from "./Glass";
import { GlossSurface } from "./GlossSurface";
import { SearchBar, useSearch } from "../features";
import { styles, SCREEN_W, SCREEN_H, fontFamilyForWeight } from "../styles/theme";
import { modelById, ModelDef } from "../models";
import { scoreConsensus } from "../services/chat";
import { useToast } from "./Toast";

const DISSENT_THRESHOLD = 0.5;

// Small deterministic starfield — fixed per field size, no true randomness needed.
function backgroundStars(fieldW: number, fieldH: number, count = 36) {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = (fieldW * ((i * 37 + 11) % 100)) / 100;
    const y = (fieldH * ((i * 53 + 29) % 100)) / 100;
    const r = 0.5 + ((i * 13) % 10) / 10;
    const o = 0.12 + ((i * 7) % 10) / 30;
    stars.push({ x, y, r, o });
  }
  return stars;
}

// Force-directed x-only layout for dissenter stars: mutually disagreeing models
// repel toward opposite ends, affine ones cluster, and higher-consensus-score
// dissenters get a mild pull toward center.
function computeDissenterX(
  n: number,
  simMatrix: number[][],
  scores: number[],
  fieldW: number,
  centerX: number,
) {
  if (n === 0) return [];
  if (n === 1) return [centerX];
  const margin = 44;
  let xs = Array.from({ length: n }, (_, i) => centerX + (i - (n - 1) / 2) * (fieldW / (n + 1)));
  const iterations = 55;
  const step = 0.05;
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const s = simMatrix[i][j];
        const dx = xs[i] - xs[j];
        const sign = dx === 0 ? (i < j ? 1 : -1) : Math.sign(dx);
        const dist = Math.max(Math.abs(dx), 8);
        const repulse = ((1 - s) * 900) / (dist * dist);
        const attract = s * dist * 0.02;
        forces[i] += sign * repulse - sign * attract;
      }
      const toCenter = centerX - xs[i];
      forces[i] += toCenter * (0.02 + scores[i] * 0.05);
    }
    for (let i = 0; i < n; i++) xs[i] += forces[i] * step;
  }
  return xs.map((x) => Math.max(margin, Math.min(fieldW - margin, x)));
}

export function ConsensusModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"current" | "history" | "settings">("current");
  const [selectedRun, setSelectedRun] = useState<ConsensusRun | null>(null);
  // Dissenting views can be read two ways: inline on the map (next to each
  // model's sphere, in context of where it sits) or as the list below. Both
  // are useful for different things (spatial read vs. scanning all of them),
  // so it's a toggle, not an either/or — the list always renders regardless.
  const [showMapLabels, setShowMapLabels] = useState(true);

  const conv = state.conversations.find(
    (c) => c.id === state.activeConversationId[state.activeCategory],
  );
  const replies = state.selectedModelIds[state.activeCategory]
    .map((id) => ({
      model: modelById(id),
      last: [...(conv?.threads[id] || [])].reverse().find((m) => m.role === "assistant" && m.content),
    }))
    .filter((x) => x.model && x.last) as { model: ModelDef; last: ChatMessage }[];

  // Token-overlap similarity — used as the pairwise-affinity input to the force
  // layout (and as the deterministic fallback if the LLM arbiter is unavailable).
  const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  const bags = replies.map((r) => new Set(tokens(r.last.content)));
  const sim = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return 0;
    let inter = 0; a.forEach((t) => { if (b.has(t)) inter++; });
    return inter / Math.sqrt(a.size * b.size);
  };

  // Real LLM-synthesized consensus + per-model alignment scores.
  // Same completeness rule as the Collide bar (CollideBanner.tsx): wait for
  // EVERY selected model to reply before synthesizing. Previously this
  // drawer synthesized from whatever subset had replied so far, while the
  // bar waited for all of them — same feature, two different answers
  // (e.g. bar: "Not available", drawer: "7/8") depending on which one you
  // looked at. Aligned to one rule.
  const selectedIds = (state.selectedModelIds[state.activeCategory] || []).filter((id) => modelById(id));
  const allIn = selectedIds.length >= 2 && replies.length === selectedIds.length;
  const [consensusResult, setConsensusResult] = useState<{ verdict: string; scores: Record<string, number> } | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const repliesKey = replies.map((r) => `${r.model.id}:${r.last.content.length}`).join("|");

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !allIn) { setConsensusResult(null); return; }
    setSynthesizing(true);
    scoreConsensus(replies.map((r) => ({ modelId: r.model.id, label: r.model.label, content: r.last.content })))
      .then((res) => { if (!cancelled) setConsensusResult(res); })
      .catch(() => { if (!cancelled) setConsensusResult(null); })
      .finally(() => { if (!cancelled) setSynthesizing(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, repliesKey, allIn]);

  const scores = consensusResult?.scores || {};
  const fallbackScore = (i: number) => {
    // Bag-of-words fallback score if the arbiter hasn't resolved / failed.
    const others = bags.filter((_, j) => j !== i);
    const maxSim = others.length ? Math.max(...others.map((b) => sim(bags[i], b))) : 0;
    return Math.max(0, Math.min(1, maxSim * 1.8));
  };
  const scoredReplies = replies.map((r, i) => ({
    ...r,
    score: scores[r.model.id] ?? fallbackScore(i),
  }));

  const agrees = scoredReplies.filter((r) => r.score >= DISSENT_THRESHOLD).length;
  const ratioN = allIn ? agrees : 0;
  const ratioM = Math.max(selectedIds.length, 1);
  // A consensus drawn from a partial scope isn't a smaller consensus, it's
  // not a consensus — so the only two states are complete (real verdict) or
  // incomplete, one word, regardless of which reason (too few replies in,
  // still synthesizing) makes it incomplete. Matches CollideBanner.tsx.
  const verdict = !allIn
    ? "Incomplete"
    : synthesizing
    ? "Synthesizing consensus…"
    : (consensusResult?.verdict || "Incomplete");

  const dissenters = scoredReplies
    .filter((r) => r.score < DISSENT_THRESHOLD)
    .map((r) => ({ modelId: r.model.id, point: r.last.content.slice(0, 120), score: r.score }));
  const lastUserPrompt = [...(conv?.threads[replies[0]?.model.id || ""] || [])].reverse().find((m) => m.role === "user")?.content || "";

  // No more drawer animation logic

  // Track last saved prompt to prevent duplicate archives
  const lastSavedPrompt = useRef("");

  const saveConsensusRun = () => {
    if (replies.length > 0 && lastUserPrompt && lastUserPrompt !== lastSavedPrompt.current) {
      dispatch({
        type: "consensus",
        run: {
          prompt: lastUserPrompt,
          category: state.activeCategory,
          ratioN,
          ratioM,
          verdict: verdict.slice(0, 500),
          dissenters,
        },
      });
      lastSavedPrompt.current = lastUserPrompt;

      if (state.autoWipeOnConsensus) {
        dispatch({ type: "newConversation", category: state.activeCategory });
        toast("Consensus archived. Active grid conversations cleared.");
      } else {
        toast("Consensus archived.");
      }
    }
  };

  // Removed panResponder and pulse animation

  const agreementPct = Math.round((ratioN / ratioM) * 100);
  const scoreColor = agreementPct >= 66 ? "#10b981" : agreementPct >= 40 ? "#f5e000" : "#ef4444"; // mid-tier was orange/gold — banned accent per SPEC.md; true yellow instead

  // Galaxy map: vertical position = alignment with consensus (higher = nearer
  // top), horizontal position = force-directed layout from pairwise affinity.
  // The map is the primary content of this view — it gets most of the
  // screen's height, not a token box squeezed between other elements.
  const fieldW = SCREEN_W - 32;
  const anchorY = 30;
  // Extra headroom under each dissenter when inline map labels are showing,
  // so the label text has somewhere to sit without overlapping the sphere.
  const fieldH = dissenters.length === 0 ? 160 : (showMapLabels ? 380 : 260);
  const centerX = fieldW / 2;
  const stars = backgroundStars(fieldW, fieldH);

  // Reserve extra bottom margin when labels can render below each sphere —
  // otherwise a low-score dissenter (placed near the bottom of the field)
  // gets its label box clipped by the map's overflow:hidden edge. Worst
  // case: 36px sphere + 4px margin + up to a 3-line, padded label (~56px)
  // = 78px of content below the sphere's own y — 120px reserve leaves real
  // margin instead of an exact-fit number that breaks the next time label
  // sizing changes.
  const bottomReserve = showMapLabels && dissenters.length > 0 ? 120 : 56;
  const dissentorData = dissenters.map((d, i) => {
    const y = anchorY + (1 - Math.min(Math.max(d.score, 0), 1)) * (fieldH - bottomReserve);
    return { d, y, idx: i };
  });

  const n = dissentorData.length;
  const dissenterBags = dissenters.map((d) => bags[replies.findIndex((r) => r.model.id === d.modelId)] || new Set<string>());
  const simMatrix = dissenters.map((_, i) => dissenters.map((_, j) => (i === j ? 1 : sim(dissenterBags[i], dissenterBags[j]))));
  const dissenterScores = dissenters.map((d) => d.score);
  const xs = computeDissenterX(n, simMatrix, dissenterScores, fieldW, centerX);

  const mappedPoints = replies.map((reply) => {
    const dissentIdx = dissentorData.findIndex(dd => dd.d.modelId === reply.model.id);
    const isDissent = dissentIdx >= 0;
    if (!isDissent) return { reply, x: centerX, y: anchorY + 10, isDissent };
    const dd = dissentorData[dissentIdx];
    const x = xs[dissentIdx] ?? centerX;
    return { reply, x, y: dd.y, isDissent };
  });

  const consSearch = useSearch(state.consensusRuns, (r) => `${r.prompt} ${r.verdict}`);

  return (
    <>
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      {/* RN Web's Modal doesn't always portal as a true full-viewport
          overlay — it can render inline in normal document flow, leaving
          the app header/search bar visible above it. StyleSheet.absoluteFill
          plus an explicit "fixed" position (ignored on native, load-bearing
          on web) forces real full-screen coverage regardless. */}
      <View style={[StyleSheet.absoluteFill, { position: "fixed" as any, backgroundColor: "rgba(0,0,0,0.8)" }]}>
        {/* True full-screen per spec — was a 90%-height bottom sheet, which
            still read as a drawer/modal rather than the dedicated full-page
            view this feature is supposed to be. */}
        <View style={[StyleSheet.absoluteFillObject, { paddingTop: insets.top, borderRadius: 0 }]} onStartShouldSetResponder={() => true}>
          <GlossSurface />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800", fontFamily: fontFamilyForWeight(800), letterSpacing: 1.5 }}>CONSENSUS</Text>
            <Pressable onPress={() => { saveConsensusRun(); onClose(); }} style={{ padding: 4, width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0c", borderRadius: 16 }}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "300" }}>×</Text>
            </Pressable>
          </View>
          
          <View style={{ flex: 1 }}>
            {/* Drawer Tabs */}
            <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)", padding: 6, gap: 4 }}>
          {(["current", "history", "settings"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
                activeTab === tab && { backgroundColor: "#0a0a0c" },
              ]}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", fontFamily: fontFamilyForWeight(700), color: activeTab === tab ? "#fff" : "#6b6478", letterSpacing: 0.5 }}>
                {tab.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1, padding: 16, paddingBottom: 16 }}>
          {activeTab === "current" && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              {/* Score is the headline metric — its own centered line, not
                  squeezed to one side of a row (that's what was wrong: it
                  read as left-aligned because it was sharing a row with the
                  summary instead of being the primary, centered element). */}
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    color: scoreColor, fontSize: 34, fontWeight: "900", fontFamily: fontFamilyForWeight(900),
                    textShadowColor: scoreColor, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
                  }}
                >
                  {ratioN}/{ratioM}
                </Text>
                <Text style={{ color: "#6b6478", fontSize: 10.5, fontFamily: fontFamilyForWeight(600), fontWeight: "600", textAlign: "center", marginTop: 1 }}>models aligned</Text>
              </View>

              {/* Summary sits in its own narrower, centered box below the
                  score — centered under the map's own center column, same
                  alignment as the center node the dashed lines fan out
                  from, so the sphere visually reads as belonging to it. */}
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#6b6478", fontSize: 10, fontWeight: "800", fontFamily: fontFamilyForWeight(800), letterSpacing: 1.2, marginBottom: 3 }}>SUMMARY</Text>
                <View style={{ width: fieldW * 0.72, backgroundColor: "rgba(147,197,253,0.07)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(147,197,253,0.2)", padding: 10, maxHeight: 64, overflow: "hidden" }}>
                  <Text
                    style={{ color: "#dbeafe", fontSize: 12, lineHeight: 16, fontFamily: fontFamilyForWeight(400), textAlign: "center" }}
                    numberOfLines={3}
                  >
                    {synthesizing ? "Synthesizing consensus…" : verdict.slice(0, 260)}
                  </Text>
                </View>
              </View>

              {/* The map is the primary content here — it gets most of the
                  vertical space instead of being squeezed between other
                  elements. Built from plain Views/LinearGradient, not
                  react-native-svg — Circle/Line/SvgText/RadialGradient
                  render blank on web in this environment. */}
              <View style={{ alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: fieldW, marginBottom: 4 }}>
                  <Text style={[styles.kicker, { marginBottom: 0 }]}>Deviation Map</Text>
                  {dissenters.length > 0 && (
                    <Pressable onPress={() => setShowMapLabels((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: showMapLabels ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)" }}>
                      <Text style={{ color: showMapLabels ? "#e2e8f0" : "#6b6478", fontSize: 10, fontWeight: "800", fontFamily: fontFamilyForWeight(800) }}>
                        {showMapLabels ? "LABELS ON" : "LABELS OFF"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View style={{ width: fieldW, height: fieldH, backgroundColor: "#000000", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  {stars.map((s, i) => (
                    <View key={`star_${i}`} style={{ position: "absolute", left: s.x - s.r, top: s.y - s.r, width: s.r * 2, height: s.r * 2, borderRadius: s.r, backgroundColor: "#ffffff", opacity: s.o }} />
                  ))}

                  {/* Dashed lines from center to each dissenter — a row of
                      short rotated segments, since RN has no native dash
                      pattern for a plain View "line". */}
                  {mappedPoints.filter((pt) => pt.isDissent).map(({ reply, x, y }) => {
                    const dx = x - centerX, dy = y - anchorY;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                    const segLen = 4, gapLen = 3, segCount = Math.floor(length / (segLen + gapLen));
                    return (
                      <View
                        key={`line_${reply.model.id}`}
                        style={{ position: "absolute", left: centerX, top: anchorY, width: length, height: 1.5, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: `${angle}deg` }], transformOrigin: "0 0" } as any}
                      >
                        {Array.from({ length: segCount }).map((_, i) => (
                          <View key={i} style={{ position: "absolute", left: i * (segLen + gapLen), width: segLen, height: 1.5, backgroundColor: "rgba(239,68,68,0.45)" }} />
                        ))}
                      </View>
                    );
                  })}

                  {/* Center node — binary agree/disagree is what this whole
                      feature measures, so blue/red duality lives here, not
                      on the Collide button itself. */}
                  {/* Was a bare gradient fill with no edge definition — every
                      other glossy sphere/button in the app gets a border +
                      shadow to read as a dimensional object, not a flat
                      circle; this was missed. Shadow lives on this outer
                      wrapper (not the inner clipped View) for the same
                      reason noted in ModelCard.tsx: overflow:hidden (needed
                      to clip the gradient to a circle) would clip a shadow
                      applied on the same node to nothing. */}
                  <View style={{
                    position: "absolute", left: centerX - 10, top: anchorY - 10, width: 20, height: 20, borderRadius: 10,
                    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
                  }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" }}>
                      <LinearGradient colors={["#93c5fd", "#2563eb", "#0f172a"]} start={{ x: 0.3, y: 0.3 }} end={{ x: 1, y: 1 }} style={{ width: "100%", height: "100%" }} />
                    </View>
                  </View>

                  {/* Dissenter stars — model-colored glossy sphere + the
                      model's own abbreviated label centered on it, plus
                      (toggleable) the dissenting point itself right below
                      the sphere it belongs to — visual analysis instead of
                      having to cross-reference a separate list. */}
                  {mappedPoints.filter((pt) => pt.isDissent).map(({ reply, x, y }) => {
                    const point = dissenters.find((d) => d.modelId === reply.model.id)?.point || "";
                    return (
                      <View key={reply.model.id} style={{ position: "absolute", left: x - 18, top: y - 18, width: 36, alignItems: "center" }}>
                        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          <LinearGradient colors={["#ffffff", reply.model.color, "#0a0512"]} start={{ x: 0.35, y: 0.35 }} end={{ x: 1, y: 1 }} style={{ width: "100%", height: "100%", position: "absolute" }} />
                          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900", fontFamily: fontFamilyForWeight(900) }}>{reply.model.short.slice(0, 4)}</Text>
                        </View>
                        {showMapLabels && point && (
                          <View style={{ marginTop: 4, width: 128, marginLeft: -46, backgroundColor: "rgba(8,6,14,0.92)", borderRadius: 6, borderWidth: 1, borderColor: `${reply.model.color}55`, padding: 6 }}>
                            <Text style={{ color: "#f2eef7", fontSize: 10.5, lineHeight: 14, fontFamily: fontFamilyForWeight(400), textAlign: "center" }} numberOfLines={3}>
                              {point}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={[styles.kicker, { marginBottom: 4 }]}>Dissenting Views ({dissenters.length})</Text>
                {dissenters.length === 0 ? (
                  <Text style={{ color: "#6b6478", fontSize: 11, fontFamily: fontFamilyForWeight(400) }}>No deviations. Full consensus achieved.</Text>
                ) : (
                  dissenters.map((d) => (
                    <View key={d.modelId} style={{ backgroundColor: "#0a0a0c", borderColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 6 }}>
                      <Text style={{ color: modelById(d.modelId)?.color || "#fff", fontWeight: "800", fontFamily: fontFamilyForWeight(800), fontSize: 11.5 }}>
                        {modelById(d.modelId)?.label}
                      </Text>
                      <Text style={{ color: "#c9c4d1", marginTop: 3, fontSize: 12, lineHeight: 16, fontFamily: fontFamilyForWeight(400) }}>{d.point}</Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {activeTab === "history" && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                <SearchBar value={consSearch.q} onChange={consSearch.setQ} placeholder="Search past runs" />
                {consSearch.filtered.length === 0 ? (
                  <Text style={styles.muted}>No past runs archived yet.</Text>
                ) : (
                  consSearch.filtered.map((run) => (
                    <Pressable key={run.id} onPress={() => setSelectedRun(run)}>
                      <Glass style={{ padding: 12, borderRadius: 14, marginBottom: 8, borderColor: "rgba(255,255,255,0.08)" }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ color: "#fff", fontWeight: "700", fontFamily: fontFamilyForWeight(700), fontSize: 13, flex: 1 }} numberOfLines={1}>
                            {run.prompt}
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "800", fontFamily: fontFamilyForWeight(800), fontSize: 12, marginLeft: 8 }}>
                            {run.ratioN}/{run.ratioM}
                          </Text>
                        </View>
                        <Text style={{ color: "#6b6478", fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                          {run.verdict}
                        </Text>
                      </Glass>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {activeTab === "settings" && (
            <View style={{ gap: 16 }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontFamily: fontFamilyForWeight(700), fontSize: 14, marginBottom: 4 }}>Consensus Summary Auto-Generated</Text>
                <Text style={{ color: "#6b6478", fontSize: 11, marginBottom: 12 }}>
                  Fill the Collide bar with a live synthesis as soon as 2+ models reply — no need to open this drawer to see whether they agree.
                </Text>
                <Pressable
                  onPress={() => dispatch({ type: "setAutoConsensusSummary", value: !state.autoConsensusSummary })}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#0a0a0c", borderRadius: 10 }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: fontFamilyForWeight(600) }}>Auto-fill Collide bar</Text>
                  <Text style={{ color: state.autoConsensusSummary ? "rgba(255,255,255,0.6)" : "#6b6478", fontSize: 18, fontWeight: "900", fontFamily: fontFamilyForWeight(900) }}>
                    {state.autoConsensusSummary ? "✓" : "○"}
                  </Text>
                </Pressable>
              </View>

              <View style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontFamily: fontFamilyForWeight(700), fontSize: 14, marginBottom: 4 }}>Auto-Wipe Conversations</Text>
                <Text style={{ color: "#6b6478", fontSize: 11, marginBottom: 12 }}>
                  Automatically archive active grid conversations when a new consensus is generated.
                </Text>
                <Pressable
                  onPress={() => dispatch({ type: "setAutoWipeOnConsensus", value: !state.autoWipeOnConsensus })}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#0a0a0c", borderRadius: 10 }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: fontFamilyForWeight(600) }}>Wipe grid on consensus save</Text>
                  <Text style={{ color: state.autoWipeOnConsensus ? "rgba(255,255,255,0.6)" : "#6b6478", fontSize: 18, fontWeight: "900", fontFamily: fontFamilyForWeight(900) }}>
                    {state.autoWipeOnConsensus ? "✓" : "○"}
                  </Text>
                </Pressable>
              </View>

              <View>
                <Text style={{ color: "#fff", fontWeight: "700", fontFamily: fontFamilyForWeight(700), fontSize: 14, marginBottom: 4 }}>Auto-Archive on New Chat</Text>
                <Text style={{ color: "#6b6478", fontSize: 11, marginBottom: 12 }}>
                  Automatically save and archive previous models' threads on conversation resets.
                </Text>
                <Pressable
                  onPress={() => dispatch({ type: "setAutoArchiveOnNew", value: !state.autoArchiveOnNew })}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#0a0a0c", borderRadius: 10 }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: fontFamilyForWeight(600) }}>Archive threads on reset</Text>
                  <Text style={{ color: state.autoArchiveOnNew ? "rgba(255,255,255,0.6)" : "#6b6478", fontSize: 18, fontWeight: "900", fontFamily: fontFamilyForWeight(900) }}>
                    {state.autoArchiveOnNew ? "✓" : "○"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
      </View>
    </Modal>

      {/* Historical Consensus Detail Popup Modal */}
      <Modal visible={!!selectedRun} transparent animationType="fade" onRequestClose={() => setSelectedRun(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedRun(null)}>
          <View style={[styles.editSheet, { width: SCREEN_W - 32, maxHeight: "80%", overflow: "hidden" }]} onStartShouldSetResponder={() => true}>
            <GlossSurface borderRadius={22} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", paddingBottom: 10, marginBottom: 12 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800", fontFamily: fontFamilyForWeight(800) }}>Historical Consensus Detail</Text>
              <Pressable onPress={() => setSelectedRun(null)} style={{ padding: 4, width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0c", borderRadius: 16 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "300" }}></Text>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedRun && (
                <View style={{ gap: 14 }}>
                  <View>
                    <Text style={{ color: "#6b6478", fontSize: 10, fontWeight: "800", fontFamily: fontFamilyForWeight(800), letterSpacing: 1 }}>PROMPT</Text>
                    <Text style={{ color: "#fff", fontSize: 13, marginTop: 4, fontWeight: "600", fontFamily: fontFamilyForWeight(600) }}>{selectedRun.prompt}</Text>
                  </View>

                  <View>
                    <Text style={{ color: "#6b6478", fontSize: 10, fontWeight: "800", fontFamily: fontFamilyForWeight(800), letterSpacing: 1 }}>CONSENSUS VERDICT ({selectedRun.ratioN}/{selectedRun.ratioM} aligned)</Text>
                    <View style={{ backgroundColor: "#0a0a0c", borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                      <Text style={{ color: "#e8e6eb", fontSize: 12, lineHeight: 18 }}>{selectedRun.verdict}</Text>
                    </View>
                  </View>

                  <View>
                    <Text style={{ color: "#6b6478", fontSize: 10, fontWeight: "800", fontFamily: fontFamilyForWeight(800), letterSpacing: 1 }}>DISSENTERS</Text>
                    {selectedRun.dissenters.length === 0 ? (
                      <Text style={{ color: "#6b6478", fontSize: 11, fontStyle: "italic", marginTop: 4 }}>No dissenters in this run.</Text>
                    ) : (
                      selectedRun.dissenters.map((d, i) => (
                        <View key={i} style={{ backgroundColor: "#0a0a0c", borderRadius: 10, padding: 10, marginTop: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                          <Text style={{ color: modelById(d.modelId)?.color || "#fff", fontWeight: "700", fontFamily: fontFamilyForWeight(700), fontSize: 11 }}>
                            {modelById(d.modelId)?.label || d.modelId}
                          </Text>
                          <Text style={{ color: "#6b6478", fontSize: 11, marginTop: 2 }}>{d.point}</Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
