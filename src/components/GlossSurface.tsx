import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// The ONE panel treatment for every dark surface in the app — headers,
// drawers, modals, banners. Redesign: a frosted, translucent dark glass
// (not flat black) so the aurora field bleeds faintly through and the panel
// reads as the same material as the cards. A vertical top→bottom gradient
// gives depth; `flat` drops the top-left specular sheen (used for the
// History and Smart Gen panels) but keeps the same translucent base.
export function GlossSurface({ borderRadius = 0, variant = "black", flat = false }: { borderRadius?: number; variant?: "black" | "white"; flat?: boolean }) {
  const dark = variant === "black";
  const top = dark ? "rgba(22,25,33,0.9)" : "rgba(244,244,246,0.96)";
  const bottom = dark ? "rgba(9,10,14,0.94)" : "rgba(228,230,236,0.96)";
  const sheen = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.5)";

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]} pointerEvents="none">
      <LinearGradient
        colors={[top, bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!flat && (
        <LinearGradient
          colors={[sheen, "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 0.35 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}
