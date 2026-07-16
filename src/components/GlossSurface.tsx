import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Real "glossy black" — not a flat near-black fill with a faint uniform
// tint (that reads as plain dark gray, which is exactly what kept getting
// flagged). Gloss comes from CONTRAST: a sharp, bright, off-axis highlight
// streak like light catching a curved reflective surface, plus a crisp
// top edge-catch line, plus corners darkening back toward true black. The
// old single flat-opacity overlay had none of that contrast.
export function GlossSurface({ borderRadius = 0, variant = "black" }: { borderRadius?: number; variant?: "black" | "white" }) {
  const dark = variant === "black";
  const base = dark ? "#040404" : "#f4f4f6";
  const vignette = dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.08)";
  const highlightPeak = dark ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.9)";
  const highlightMid = dark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)";
  const edgeLine = dark ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.9)";

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />

      {/* Sharp specular streak — multi-stop so the highlight has a real
          peak and falls off quickly on either side, instead of one smooth
          linear fade (which just looks like a tint, not a reflection). */}
      <LinearGradient
        colors={["transparent", "transparent", highlightMid, highlightPeak, highlightMid, "transparent", "transparent"]}
        locations={[0, 0.22, 0.34, 0.42, 0.5, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Corner vignette — pulls the far corner back toward true black/white
          so the highlight reads as sitting ON a curved surface, not just
          floating over a flat tint. */}
      <LinearGradient
        colors={["transparent", vignette]}
        start={{ x: 0.3, y: 0.1 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top edge-catch line — the classic glossy-bezel cue: a crisp bright
          (or dark, for the white variant) hairline exactly on the top
          edge, as if it's catching a light source the rest of the panel
          doesn't. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: edgeLine }} />
    </View>
  );
}
