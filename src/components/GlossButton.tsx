import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// The small-surface counterpart to GlossSurface — for buttons, chips, and
// icon circles, which had been using a flat semi-transparent white fill
// (rgba(255,255,255,0.05-0.08) on a black background). That reads as flat
// GRAY, not black — a low-opacity white wash over black IS gray, just
// spelled differently. This gives small interactive shapes the same
// black-base-plus-gloss language as the big panels, with a two-tone
// top/bottom border faking a raised chamfer (RN has no inset shadow) so
// they read as pressable objects with depth, not flat paint.
export function GlossButton({ borderRadius = 14, active = false }: { borderRadius?: number; active?: boolean }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius,
          overflow: "hidden",
          backgroundColor: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)",
        },
      ]}
      pointerEvents="none"
    >
      {/* Top-left specular sheen — the inset highlight that reads as glass. */}
      <LinearGradient
        colors={["rgba(255,255,255,0.13)", "rgba(255,255,255,0)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.45, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
