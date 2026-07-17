import React from "react";
import { Pressable, View } from "react-native";

// RN Web's native <Switch> renders as an <input type="checkbox" role="switch">
// with accentColor left as "auto" — it ignores trackColor/thumbColor entirely
// on web and falls back to the browser's own default (usually system blue or
// green), which is exactly why a switch set to the app's silver/chrome accent
// rendered bright green in practice. Same class of problem Picker.tsx already
// solved by dropping the raw HTML <select>. This is a plain Pressable, so it
// always respects the app's own colors regardless of platform.
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        padding: 2,
        justifyContent: "center",
        backgroundColor: value ? "rgba(226,232,240,0.9)" : "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: value ? "rgba(226,232,240,0.9)" : "rgba(255,255,255,0.16)",
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: value ? "#000000" : "#ffffff",
          alignSelf: value ? "flex-end" : "flex-start",
        }}
      />
    </Pressable>
  );
}
