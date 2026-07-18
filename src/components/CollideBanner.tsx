import React, { useEffect, useState } from "react";
import { View, Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCollider } from "../state";
import { modelById } from "../models";
import { scoreConsensus } from "../services/chat";

const DISSENT_THRESHOLD = 0.5;

// Proactive-value bar: the user types a prompt, gets replies from every
// selected model, and the synthesis of what they said is sitting right
// here — above the composer, zero extra taps — instead of being locked
// behind a drawer only the curious would ever open. Tapping still opens the
// full Consensus drawer for the map/dissenter detail; this is the "give it
// to them before they ask" layer on top of that.
export function CollideBanner({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { state } = useCollider();
  const cat = state.activeCategory;
  const conv = state.conversations.find((c) => c.id === state.activeConversationId[cat]);
  const selectedIds = state.selectedModelIds[cat] || [];
  const replies = selectedIds
    .map((id) => ({
      id,
      last: [...(conv?.threads[id] || [])].reverse().find((m) => m.role === "assistant" && m.content),
    }))
    .filter((r) => r.last) as { id: string; last: { content: string } }[];

  // Wait for EVERY selected model to land (a real reply or an error both
  // count — either way there's nothing left pending) before synthesizing.
  // Firing as soon as 2 of, say, 4 were in meant "consensus" sometimes
  // meant "half the panel hasn't even weighed in yet."
  const allIn = selectedIds.length >= 2 && replies.length === selectedIds.length;

  const repliesKey = replies.map((r) => `${r.id}:${r.last.content.length}`).join("|");
  const [result, setResult] = useState<{ verdict: string; scores: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!state.autoConsensusSummary || !allIn) { setResult(null); return; }
    setLoading(true);
    scoreConsensus(replies.map((r) => ({ modelId: r.id, label: modelById(r.id)?.label || r.id, content: r.last.content })))
      .then((res) => { if (!cancelled) setResult(res); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repliesKey, allIn, state.autoConsensusSummary]);

  // Fraction, not a percentage — "3/4 models agree" is a direct count you
  // can sanity-check against the panel; "72%" is a number you have to
  // trust. Same aligned/total math as the full drawer's own "N/M" readout.
  const scores = result?.scores || {};
  const agreeCount = replies.filter((r) => (scores[r.id] ?? 0) >= DISSENT_THRESHOLD).length;
  const totalCount = replies.length;
  const ratio = totalCount ? agreeCount / totalCount : 0;
  const hasScore = !!result;
  const scoreColor = !hasScore ? "#e2e8f0" : ratio >= 0.66 ? "#10b981" : ratio >= 0.4 ? "#ffb74d" : "#ef4444";

  const showSummary = state.autoConsensusSummary && selectedIds.length >= 2;
  const showMedallion = showSummary && (hasScore || (loading && allIn));

  return (
    <View style={{ marginHorizontal: 14, marginTop: showMedallion ? 20 : 2 }}>
      <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[styles.banner, disabled && { opacity: 0.4 }]}>
        <LinearGradient
          colors={["#1c1030", "#3a1f5c", "#0a0612"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {showSummary ? (
          !allIn ? (
            <Text style={styles.summary} numberOfLines={2}>
              Waiting on {selectedIds.length - replies.length} of {selectedIds.length} replies…
            </Text>
          ) : loading && !result ? (
            <Text style={[styles.summary, showMedallion && { marginTop: 14 }]} numberOfLines={2}>
              Synthesizing consensus…
            </Text>
          ) : (
            <Text style={[styles.summary, showMedallion && { marginTop: 14 }]} numberOfLines={2}>
              <Text style={styles.summaryLead}>Consensus: </Text>
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
          family as the bar itself, with a gold ring as the focal frame. */}
      {showMedallion && (
        <View style={styles.medallion} pointerEvents="none">
          <LinearGradient
            colors={["#4a2f8a", "#160c28"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {hasScore ? (
            <Text style={[styles.medallionScore, { color: scoreColor, textShadowColor: scoreColor }]}>{agreeCount}/{totalCount}</Text>
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
    shadowColor: "#3a1f5c",
    shadowOpacity: 0.6,
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
  summaryLead: {
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
