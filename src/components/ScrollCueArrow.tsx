import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// "There's more below" cue — the convention from racing games / any UI that
// wants to hint at more content beneath the fold: a chevron with a few
// short dashes trailing upward, fading out. Static, not animated — a bounce
// only reads as "deliberate and premium" at a real 60-120fps; anything
// slower reads as low-framerate stutter, which is worse than no motion at
// all. Belongs on the Collide bar (there's more detail behind "Consensus:"
// on tap), not on individual model cards.
export function ScrollCueArrow() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.dash1} />
      <View style={styles.dash2} />
      <Ionicons name="chevron-down" size={13} color="rgba(226,232,240,0.85)" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 2,
  },
  dash1: {
    width: 14,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(226,232,240,0.18)",
  },
  dash2: {
    width: 18,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "rgba(226,232,240,0.35)",
  },
});
