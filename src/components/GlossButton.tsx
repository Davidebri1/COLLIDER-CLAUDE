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
          backgroundColor: active ? "#141416" : "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderTopColor: "rgba(255,255,255,0.22)",
          borderLeftColor: "rgba(255,255,255,0.14)",
          borderRightColor: "rgba(0,0,0,0.5)",
          borderBottomColor: "rgba(0,0,0,0.6)",
        },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0)"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
