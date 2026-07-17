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
  const shinePeak = dark ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.95)";
  const edgeLine = dark ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)";

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />

      {/* The shine spot itself — a small FIXED-size ellipse, not a
          percentage of the container. Percentage sizing made this balloon
          into a huge blob on small panels (modals, chips) while looking
          right only on large ones — a fixed size keeps it reading as one
          consistent tight highlight at every panel size.
          Fully inside the container (not straddling the clip edge) — it
          was previously positioned half off the top, which combined with
          the parent's overflow:hidden cut it into a flat-edged smudge
          instead of a soft contained highlight. */}
      <View style={{ position: "absolute", top: 2, left: 6, width: 90, height: 46, borderRadius: 999, overflow: "hidden" }}>
        <LinearGradient
          // Peak sits in the MIDDLE (position 0.5), transparent on BOTH
          // ends — a gradient that starts bright at 0% has its peak right
          // at the shape's edge, which reads as a hard bright wedge/
          // crescent, not a glow. Fading in-out-in like this is what
          // actually makes it read as a soft spot of light sitting on the
          // surface. Every stop shares white's RGB (alpha-only fade) so it
          // doesn't shift through gray/black like the "transparent"
          // keyword (rgba(0,0,0,0)) would.
          colors={["rgba(255,255,255,0)", shinePeak, "rgba(255,255,255,0)"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Top edge-catch line — a crisp hairline on the top edge, the other
          half of the "glossy bezel" cue alongside the shine spot. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: edgeLine }} />
    </View>
  );
}
