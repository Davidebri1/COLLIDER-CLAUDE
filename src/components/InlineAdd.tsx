import React from "react";
import { TextInput, Pressable, Text } from "react-native";
import { Glass } from "./Glass";
import { styles } from "../styles/theme";

export function InlineAdd({
  value, setValue, placeholder, onAdd, compact,
}: {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  onAdd: () => void;
  compact?: boolean;
}) {
  return (
    <Glass style={[styles.inlineAdd, compact && styles.compact]}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#8f849c"
        style={styles.inlineInput}
      />
      <Pressable onPress={onAdd} style={styles.addBtn}>
        {/* addBtn is a solid white fill (high-contrast palette) — needs a
            dark glyph, not styles.primaryText, which is meant for the
            translucent primaryBtn background and would render invisible
            (white on white) here. */}
        <Text style={{ fontSize: 18, color: "#000" }}>＋</Text>
      </Pressable>
    </Glass>
  );
}
