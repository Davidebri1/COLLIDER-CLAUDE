import React, { ReactNode } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../styles/theme";
import { GlossSurface } from "./GlossSurface";

// Same chevron-back icon CardScreen's own header uses — the typographic "‹"
// glyph this used to render read as a different visual language next to
// Card view's Ionicons icon, even though the button chrome was identical.
function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn}>
      <Ionicons name="chevron-back" size={20} color="#ffffff" />
    </Pressable>
  );
}

// Header treatment matches CardScreen's: the same gloss surface every other
// panel/header in the app uses, dissolving into the content below via a
// short gradient instead of a hard border line — keeps every "‹ Title"
// screen (History included) visually consistent with the Card view's own
// header.
export function Page({ title, goBack, children }: { title: string; goBack: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: "rgba(4, 4, 4, 0.45)" }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: 56 + insets.top, overflow: "hidden" }]}>
        <GlossSurface />
        <BackButton onPress={goBack} />
        <Text style={styles.pageTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <LinearGradient
        colors={["#040404", "rgba(4,4,4,0)"]}
        style={{ height: 10, marginTop: -1 }}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={styles.page}>{children}</ScrollView>
    </View>
  );
}

