import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Static "tap to open the full page" affordance — not a scroll/expand cue.
// Two things this got wrong before, twice: (1) a bounce/loop animation —
// a janky, low-framerate-looking motion cue reads as urgency this feature
// doesn't have, so it stays stationary; (2) a downward chevron, which is
// the correct glyph for "scroll down, more of this same content is below"
// but the wrong one here — tapping this navigates to an entirely separate
// full-screen destination, it doesn't reveal more of the preview in place.
// A forward chevron matches "go to another screen," not "expand downward."
export function ScrollCueArrow() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.dash, styles.dash1]} />
      <View style={[styles.dash, styles.dash2]} />
      <View style={[styles.dash, styles.dash3]} />
      <Ionicons name="chevron-forward" size={11} color="rgba(255, 255, 255, 0.75)" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1.5,
    marginTop: 2,
  },
  // Trail runs left-to-right, growing into the forward chevron — same
  // "leading into the arrow" shape as before, just rotated 90° to match
  // the glyph now pointing right instead of down.
  dash: {
    width: 1,
    borderRadius: 0.5,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  dash1: {
    height: 4,
  },
  dash2: {
    height: 7,
  },
  dash3: {
    height: 10,
  },
});
