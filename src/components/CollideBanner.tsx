import React, { useEffect, useState } from "react";
import { View, Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Polygon } from "react-native-svg";
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

  // Fraction, not a percentage — a direct count you can sanity-check
  // against the panel, not a number you have to trust.
  const scores = result?.scores || {};
  const agreeCount = replies.filter((r) => (scores[r.id] ?? 0) >= DISSENT_THRESHOLD).length;
  const totalCount = replies.length;
  const ratio = totalCount ? agreeCount / totalCount : 0;
  const hasScore = !!result;
  const scoreColor = !hasScore ? "#e2e8f0" : ratio >= 0.66 ? "#10b981" : ratio >= 0.4 ? "#ffb74d" : "#ef4444";

  const showSummary = state.autoConsensusSummary && selectedIds.length >= 2;
  const showBadge = showSummary && (hasScore || (loading && allIn));

  const gradId = "collideBadgeGrad";

  return (
    <View style={{ marginHorizontal: 14, marginTop: 2, alignItems: "center" }}>
      {/* The score tab — sits fully ABOVE the bar (touching, not overlapping
          into it) so the bar keeps its full interior height for text
          instead of losing space to a badge dug into its top. A trapezoid,
          not a circle: an angled shape holds a 2-3 character fraction more
          efficiently than a circle/semicircle does. */}
      {showBadge && (
        <View style={{ marginBottom: -1 }}>
          <Svg width={60} height={24} viewBox="0 0 60 24">
            <Defs>
              <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#5a1f9e" />
                <Stop offset="1" stopColor="#170a2e" />
              </SvgGradient>
            </Defs>
            <Polygon points="2,24 58,24 50,1 10,1" fill={`url(#${gradId})`} stroke={GOLD} strokeWidth={1.5} />
          </Svg>
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingBottom: 2 }]}>
            {hasScore ? (
              <Text style={[styles.badgeScore, { color: scoreColor, textShadowColor: scoreColor }]}>{agreeCount}/{totalCount}</Text>
            ) : (
              <ActivityIndicator size="small" color="#ffd66b" />
            )}
          </View>
        </View>
      )}

      <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[styles.banner, disabled && { opacity: 0.4 }]}>
        <LinearGradient
          colors={["#3a0d63", "#1a0733", "#050208"]}
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
            <Text style={styles.summary} numberOfLines={2}>
              Synthesizing consensus…
            </Text>
          ) : (
            <Text style={styles.summary} numberOfLines={2}>
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
    </View>
  );
}

const GOLD = "#d4af37";

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.5)",
    overflow: "hidden",
    shadowColor: "#1a0733",
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  badgeScore: {
    fontSize: 12.5,
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
