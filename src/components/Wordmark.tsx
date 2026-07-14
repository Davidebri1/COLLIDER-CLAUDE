import React from "react";
import { View, Text } from "react-native";
import { styles } from "../styles/theme";

export function Wordmark() {
  return (
    <View style={styles.wordmarkWrap}>
      <View style={styles.wordmarkAccent} />
      <Text style={styles.wordmarkText}>COLLIDER</Text>
      <View style={styles.wordmarkAccent} />
    </View>
  );
}
