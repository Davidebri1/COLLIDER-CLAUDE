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
        <Text style={styles.primaryText}>＋</Text>
      </Pressable>
    </Glass>
  );
}
