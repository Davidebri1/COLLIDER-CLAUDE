import React, { ReactNode } from "react";
import { View, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles, GLASS_CARD } from "../styles/theme";

// Frosted glass surface (Collider redesign). Both variants share the same
// diagonal top-light → bottom-dark gradient fill + a hairline highlight edge,
// so a card and a panel read as the same material at different scales.
export function Glass({ children, style, isCard }: { children?: ReactNode; style?: StyleProp<ViewStyle>; isCard?: boolean; [k:string]:any }) {
  return (
    <View style={[styles.glass, { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }, style]}>
      <LinearGradient
        colors={GLASS_CARD}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Top-left specular sheen — the inset highlight that sells the glass. */}
      <LinearGradient
        colors={["rgba(255,255,255,0.13)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 0.35 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
