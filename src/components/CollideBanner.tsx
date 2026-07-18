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
  const showMedallion = showSummary && (avgScore !== null || loading);

  return (
    <View style={{ marginHorizontal: 14, marginTop: showMedallion ? 20 : 2 }}>
      <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[styles.banner, disabled && { opacity: 0.4 }]}>
        <LinearGradient
          colors={["#2a1f6b", "#2d3fa8", "#0d1140"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {showSummary ? (
          loading && !result ? (
            <Text style={[styles.summary, showMedallion && { marginTop: 14 }]} numberOfLines={2}>
              Synthesizing what {replies.length} models agree on…
            </Text>
          ) : (
            <Text style={[styles.summary, showMedallion && { marginTop: 14 }]} numberOfLines={2}>
              {result?.verdict || "Not enough responses yet."}
            </Text>
          )
        ) : (
          <>
            <Text style={styles.title}>COLLIDE</Text>
            <Text style={styles.sub}>{disabled ? "Select 2+ models to compare" : "Tap or drag up for consensus"}</Text>
          </>
        )}
      </Pressable>

      {/* The score medallion — embedded into the bar's top edge (half
          overlapping, not floating above it) so it reads as one object
          with the bar, not a separate chip stapled on top. Same gradient
          family as the bar itself, with a gold ring as the focal frame —
          this is the single most valuable number on the screen, so it
          gets the size and prominence to match, not a cramped label. */}
      {showMedallion && (
        <View style={styles.medallion} pointerEvents="none">
          <LinearGradient
            colors={["#3b4fc7", "#1a1450"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {avgScore !== null ? (
            <Text style={[styles.medallionScore, { color: scoreColor, textShadowColor: scoreColor }]}>{avgScore}%</Text>
          ) : (
            <ActivityIndicator size="small" color="#ffd66b" />
          )}
        </View>
      )}
    </View>
  );
}

const GOLD = "#d4af37";

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.5)",
    overflow: "hidden",
    shadowColor: "#1d2c8f",
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  medallion: {
    position: "absolute",
    top: -20,
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  medallionScore: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
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
