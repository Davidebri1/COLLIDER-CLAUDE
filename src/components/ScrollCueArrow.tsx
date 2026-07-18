import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Animated "there's more" cue with horizontal gradient tail dashes fading upwards
export function ScrollCueArrow() {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animValue]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });

  const opacity1 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.1, 0.25, 0.1],
  });

  const opacity2 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.2, 0.45, 0.2],
  });

  const opacity3 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.7, 0.3],
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.dash, styles.dash1, { opacity: opacity1 }]} />
      <Animated.View style={[styles.dash, styles.dash2, { opacity: opacity2 }]} />
      <Animated.View style={[styles.dash, styles.dash3, { opacity: opacity3 }]} />
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Ionicons name="chevron-down" size={11} color="rgba(255, 255, 255, 0.9)" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 1.5,
    marginTop: 2,
  },
  dash: {
    height: 1,
    borderRadius: 0.5,
    backgroundColor: "#ffffff",
  },
  dash1: {
    width: 6,
  },
  dash2: {
    width: 10,
  },
  dash3: {
    width: 14,
  },
});
