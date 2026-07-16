import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// The ONE panel treatment for every dark surface in the app — headers,
// drawers, modals, banners. Do not hand-roll a different dark gradient per
// component; import this instead, so a palette change happens in one place.
//
// Gloss is a SHINE SPOT, not a ribbon: a small, tight, bright highlight
// tucked near one corner, like light catching one point on a curved glass
// surface — not a soft diagonal band stretched across the whole panel
// (that reads as a low-res smear, not a reflection). Real specular
// highlights are small and sharp relative to the surface they're on.
export function GlossSurface({ borderRadius = 0, variant = "black" }: { borderRadius?: number; variant?: "black" | "white" }) {
  const dark = variant === "black";
  const base = dark ? "#040404" : "#f4f4f6";
  const shinePeak = dark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.95)";
  const shineFade = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
  const edgeLine = dark ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)";

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />

      {/* The shine spot itself — a small FIXED-size ellipse, not a
          percentage of the container. Percentage sizing made this balloon
          into a huge blob on small panels (modals, chips) while looking
          right only on large ones — a fixed size keeps it reading as one
          consistent tight highlight at every panel size. */}
      <View style={{ position: "absolute", top: -18, left: 8, width: 90, height: 50, borderRadius: 999, overflow: "hidden" }}>
        <LinearGradient
          colors={[shinePeak, shineFade, "transparent"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.25, y: 0.1 }}
          end={{ x: 0.85, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Top edge-catch line — a crisp hairline on the top edge, the other
          half of the "glossy bezel" cue alongside the shine spot. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: edgeLine }} />
    </View>
  );
}
