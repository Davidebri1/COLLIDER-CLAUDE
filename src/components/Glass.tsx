import React, { ReactNode } from "react";
import { View, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/theme";

export function Glass({ children, style, isCard }: { children: ReactNode; style?: StyleProp<ViewStyle>; isCard?: boolean }) {
  if (isCard) {
    return (
      <View style={[styles.glass, { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(226,232,240,0.3)" }, style]}>
        {/* A border you can barely perceive is worse than none — it reads
            as unresolved noise (did I imagine that edge?) instead of an
            intentional boundary. An earlier pass removed it entirely to
            avoid looking like "a grid of squares," but the alternative
            (no visible bound at all) forces the same visual search on
            every card, every time. Visible silver/chrome border instead —
            deliberate, not squares. */}
        <LinearGradient
          colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.35, y: 0.3 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.glass, { backgroundColor: "#111114", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }, style]}>
      {children}
    </View>
  );
}
