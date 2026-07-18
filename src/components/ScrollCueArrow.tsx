import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// "There's more below" cue — the convention from racing games / any UI that
// wants to hint at more content beneath the fold without a scrollbar: a
// chevron with a few short dashes trailing upward, fading out, and a slow,
// small bounce. Purely a hint, not a distraction — no fast motion, no long
// travel distance, no loud color. Shown only when the content genuinely
// overflows the visible area (caller decides that; this component is pure
// presentation).
export function ScrollCueArrow() {
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.dash1} />
      <View style={styles.dash2} />
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Ionicons name="chevron-down" size={13} color="rgba(226,232,240,0.85)" />
      </Animated.View>
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
