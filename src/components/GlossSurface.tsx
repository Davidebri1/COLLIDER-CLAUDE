import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// The ONE panel treatment for every dark surface in the app — headers,
// drawers, modals, banners.
//
// The diagonal two-stop gradient below is a hand-built approximation of a
// glossy highlight, not a real one — a genuine gloss surface needs a soft
// radial highlight (see the Figma reference built to compare:
// figma.com/design/QeuI8DZh65zYmN7ZovLxn4 — flat panel vs. a real
// radial-highlight/SCREEN-blend panel side by side). Until that's actually
// built properly (imported asset or a correct radial technique), `flat`
// renders pure solid black with no fake highlight at all — used for the
// History and Smart Gen panels specifically.
export function GlossSurface({ borderRadius = 0, variant = "black", flat = false }: { borderRadius?: number; variant?: "black" | "white"; flat?: boolean }) {
  const dark = variant === "black";
  const base = dark ? "#040404" : "#f4f4f6";
  const shine = dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.5)";

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", backgroundColor: base }]} pointerEvents="none">
      {!flat && (
        <LinearGradient
          colors={[shine, dark ? "rgba(255,255,255,0)" : "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 0.3 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}
