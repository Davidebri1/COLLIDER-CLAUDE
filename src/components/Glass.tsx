import React, { ReactNode } from "react";
import { View, StyleProp, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/theme";

export function Glass({ children, style, isCard }: { children: ReactNode; style?: StyleProp<ViewStyle>; isCard?: boolean }) {
  if (isCard) {
    return (
      <View style={[styles.glass, { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.28)" }, style]}>
        {/* Real glass, not frosted plastic: no blur wash and no full-card
            sheen — those read as a milky white film with nothing dark
            backing them on web. Just a crisp border and a small corner
            highlight, like light catching the edge of a window pane. */}
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
