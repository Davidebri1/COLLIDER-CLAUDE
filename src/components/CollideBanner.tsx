import React, { useEffect, useState } from "react";
import { View, Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCollider } from "../state";
import { modelById } from "../models";
import { scoreConsensus } from "../services/chat";

// Proactive-value bar: the user types a prompt, gets replies from 2+
// selected models, and the synthesis of what they said is sitting right
// here — above the composer, zero extra taps — instead of being locked
// behind a drawer only the curious would ever open. Tapping still opens the
// full Consensus drawer for the map/dissenter detail; this is the "give it
// to them before they ask" layer on top of that.
export function CollideBanner({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { state } = useCollider();
  const cat = state.activeCategory;
  const conv = state.conversations.find((c) => c.id === state.activeConversationId[cat]);
  const replies = (state.selectedModelIds[cat] || [])
    .map((id) => ({
      id,
      last: [...(conv?.threads[id] || [])].reverse().find((m) => m.role === "assistant" && m.content),
    }))
    .filter((r) => r.last) as { id: string; last: { content: string } }[];

  const repliesKey = replies.map((r) => `${r.id}:${r.last.content.length}`).join("|");
  const [result, setResult] = useState<{ verdict: string; scores: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!state.autoConsensusSummary || replies.length < 2) { setResult(null); return; }
    setLoading(true);
    scoreConsensus(replies.map((r) => ({ modelId: r.id, label: modelById(r.id)?.label || r.id, content: r.last.content })))
      .then((res) => { if (!cancelled) setResult(res); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repliesKey, state.autoConsensusSummary]);

  const scoreValues = result ? Object.values(result.scores) : [];
  const avgScore = scoreValues.length ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100) : null;
  const scoreColor = avgScore === null ? "#e2e8f0" : avgScore >= 66 ? "#10b981" : avgScore >= 40 ? "#ffb74d" : "#ef4444";

  const showSummary = state.autoConsensusSummary && replies.length >= 2;

  return (
    <View style={{ marginHorizontal: 14, marginTop: 2, alignItems: "center" }}>
      {/* The lip — was a plain decorative tab; now it's the score badge when
          a synthesis is available, so the color-coded verdict is visible
          before the user even taps in. */}
      <View style={[styles.post, showSummary && avgScore !== null && { borderColor: scoreColor }]}>
        {showSummary && avgScore !== null ? (
          <Text style={[styles.postScore, { color: scoreColor, textShadowColor: scoreColor }]}>{avgScore}%</Text>
        ) : showSummary && loading ? (
          <ActivityIndicator size="small" color="#ffd66b" />
        ) : null}
      </View>

      <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[styles.banner, disabled && { opacity: 0.4 }]}>
        <LinearGradient
          colors={["#241a5e", "#2b3fa8", "#0d1140"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {showSummary ? (
          loading && !result ? (
            <Text style={styles.summary} numberOfLines={2}>Synthesizing what {replies.length} models agree on…</Text>
          ) : (
            <Text style={styles.summary} numberOfLines={2}>{result?.verdict || "Not enough responses yet."}</Text>
          )
        ) : (
          <>
            <Text style={styles.title}>COLLIDE</Text>
            <Text style={styles.sub}>{disabled ? "Select 2+ models to compare" : "Tap or drag up for consensus"}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const GOLD = "#d4af37";

const styles = StyleSheet.create({
  post: {
    width: 52,
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#0d1140",
    borderWidth: 1.5,
    borderColor: GOLD,
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -9,
    zIndex: 2,
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  postScore: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  banner: {
    width: "100%",
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: GOLD,
    overflow: "hidden",
    shadowColor: "#1d2c8f",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  title: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  sub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  summary: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
});
