import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// The ONE panel treatment for every dark surface in the app — headers,
// drawers, modals, banners. Same corner-highlight technique Glass.tsx
// already uses for cards: a solid base plus one simple two-stop gradient,
// same RGB on both stops (alpha-only fade, no color shift). Nothing else.
export function GlossSurface({ borderRadius = 0, variant = "black" }: { borderRadius?: number; variant?: "black" | "white" }) {
  const dark = variant === "black";
  const base = dark ? "#040404" : "#f4f4f6";
  const shine = dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.5)";

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", backgroundColor: base }]} pointerEvents="none">
      <LinearGradient
        colors={[shine, dark ? "rgba(255,255,255,0)" : "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
