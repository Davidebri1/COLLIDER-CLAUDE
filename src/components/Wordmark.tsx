import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { styles, FONT_BOLD } from "../styles/theme";

// COLLIDER wordmark — a white → slate vertical gradient clip (redesign),
// flanked by hairlines. React Native can't gradient-clip a normal <Text>, so
// the letters are drawn as SVG text with a real gradient fill; the soft halo
// comes from the flanking rule + the surrounding aurora, not a text shadow.
export function Wordmark() {
  return (
    <View style={styles.wordmarkWrap}>
      <View style={styles.wordmarkAccent} />
      <Svg width={170} height={22} viewBox="0 0 170 22">
        <Defs>
          <LinearGradient id="wm" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.2" stopColor="#ffffff" />
            <Stop offset="0.9" stopColor="#96a0b4" />
          </LinearGradient>
        </Defs>
        <SvgText
          x="89"
          y="16"
          fill="url(#wm)"
          fontFamily={FONT_BOLD}
          fontSize="15"
          fontWeight="700"
          letterSpacing="9"
          textAnchor="middle"
        >
          COLLIDER
        </SvgText>
      </Svg>
      <View style={styles.wordmarkAccent} />
    </View>
  );
}
