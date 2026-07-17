import React, { ReactNode } from "react";
import { View, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/theme";

export function Glass({ children, style, isCard }: { children: ReactNode; style?: StyleProp<ViewStyle>; isCard?: boolean }) {
  if (isCard) {
    return (
      <View style={[styles.glass, { backgroundColor: "transparent", borderWidth: 0 }, style]}>
        {/* No border — just the corner highlight and whatever content sits
            on top. A visible outline around every card read as a grid of
            squares, not glass panes. */}
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
