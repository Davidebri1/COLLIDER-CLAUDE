import React, { useEffect, useState } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Path } from "react-native-svg";
import { useCollider } from "../state";
import { modelById } from "../models";
import { scoreConsensus } from "../services/chat";

const DISSENT_THRESHOLD = 0.5;
const SILVER = "#e2e8f0";
// A border you can barely see reads as noise (was it intentional? is it a
// rendering glitch?), not as a boundary. Same width/color on the badge and
// the bar below it, opaque enough to read as one deliberate frame.
const BORDER = "rgba(226,232,240,0.65)";

// Proactive-value bar: the user types a prompt, gets replies from every
// selected model, and the synthesis of what they said is sitting right
// here — above the composer, zero extra taps — instead of being locked
// behind a drawer only the curious would ever open. Tapping still opens the
// full Consensus drawer for the map/dissenter detail; this is the "give it
// to them before they ask" layer on top of that.
//
// A consensus is only a valid claim if it's drawn from a fully declared,
// bound scope — synthesizing from a partial subset and calling it
// "consensus" isn't a smaller consensus, it's not a consensus at all. So
// this only ever has two states: complete (show the real verdict/score) or
// incomplete (say so, plainly). "Consensus:" and the score are the bar's
// permanent identity — they don't disappear depending on which of the
// several reasons (too few selected, still waiting, a model errored) the
// scope isn't complete; the reason doesn't change what's true, so it
// collapses to one word: "Incomplete."
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
  const scoreColor = !hasScore ? SILVER : ratio >= 0.66 ? "#10b981" : ratio >= 0.4 ? "#ffb74d" : "#ef4444";
  const available = state.autoConsensusSummary && hasScore;

  const gradId = "collideBadgeGrad";

  return (
    <View style={{ marginHorizontal: 14, marginTop: 2, alignItems: "center" }}>
      {/* The score tab — sits fully ABOVE the bar (touching, not overlapping
          into it) so the bar keeps its full interior height for text
          instead of losing space to a badge dug into its top. A trapezoid,
          not a circle: an angled shape holds a 2-3 character fraction more
          efficiently than a circle/semicircle does. Always rendered —
          "Consensus:" and the score are this bar's identity, not a state
          that comes and goes.
          The badge's Path is drawn with the bottom edge OPEN (no L back to
          the start, no Z) so only the two slanted sides + top are stroked —
          the bar's own top border below is what visually closes the shape,
          at the exact same width/color, so it reads as one continuous
          outline instead of two mismatched borders with a seam between
          them (badge stroke was 1.25px, bar border was 1px, with a visible
          gap line where they met). */}
      <View style={{ marginBottom: 0 }}>
        <Svg width={60} height={24} viewBox="0 0 60 24">
          <Defs>
            <SvgGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#5a1f9e" />
              <Stop offset="1" stopColor="#170a2e" />
            </SvgGradient>
          </Defs>
          <Path d="M2,24 L10,1 L50,1 L58,24" fill={`url(#${gradId})`} stroke={BORDER} strokeWidth={1.5} strokeLinejoin="round" />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingBottom: 2 }]}>
          <Text style={[styles.badgeScore, { color: scoreColor, textShadowColor: scoreColor }]}>
            {available ? `${agreeCount}/${totalCount}` : "–/–"}
          </Text>
        </View>
      </View>

      <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[styles.banner, disabled && { opacity: 0.4 }]}>
        <LinearGradient
          colors={["#3a0d63", "#1a0733", "#050208"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.summary} numberOfLines={2}>
          <Text style={styles.summaryLead}>Consensus: </Text>
          {available ? result!.verdict : "Incomplete"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    // No top border — the badge's own Path already draws that edge (its
    // stroke covers the two slanted sides + top). Giving the bar a top
    // border too would draw the same edge twice, which is exactly the
    // visible double-line seam this was meant to fix.
    borderTopWidth: 0,
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
