import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { withFont, fontFamilyForWeight } from "../styles/theme";

// Shared bulk-select toolbar for list screens (Memory, Reminders, Projects,
// Artifacts, Files, History). Screens own their own selection Set — this is
// just the row of controls that appears once something's selected.
export function SelectionBar({
  count, total, onSelectAll, onClear, onDelete,
}: {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;
  const allSelected = count >= total;
  return (
    <View style={localStyles.bar}>
      <Pressable onPress={onClear} hitSlop={8} style={localStyles.iconBtn}>
        <Ionicons name="close" size={16} color="#fff" />
      </Pressable>
      <Text style={localStyles.count}>{count} selected</Text>
      <Pressable onPress={onSelectAll} style={localStyles.textBtn}>
        <Text style={localStyles.textBtnLabel}>{allSelected ? "Deselect all" : "Select all"}</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={localStyles.deleteBtn}>
        <Ionicons name="trash-outline" size={13} color="#fff" />
        <Text style={localStyles.deleteLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

// Toggleable select-mode entry point for a screen header — a small pill
// button, not a checkbox on every row by default (keeps the normal list
// uncluttered until the user actually wants to bulk-act).
export function SelectModeToggle({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[localStyles.toggle, active && localStyles.toggleActive]}>
      <Ionicons
        name={active ? "close-circle-outline" : "checkmark-circle-outline"}
        size={13}
        color={active ? "#e2e8f0" : "rgba(255,255,255,0.55)"}
      />
      <Text style={[localStyles.toggleLabel, active && localStyles.toggleLabelActive]}>
        {active ? "Cancel" : "Select"}
      </Text>
    </Pressable>
  );
}

// Small checkbox circle used at the leading edge of a row in select mode.
export function SelectDot({ selected }: { selected: boolean }) {
  return (
    <View style={[localStyles.dot, selected && localStyles.dotSelected]}>
      {selected && <Ionicons name="checkmark" size={12} color="#000" />}
    </View>
  );
}

// See RemindersScreen.tsx for why withFont is required here: without it,
// fontWeight 700+ resolves to synthetic faux-bold instead of the real
// static Manrope Bold/ExtraBold file. Also de-purpled per the black &
// white / high-contrast palette direction.
const localStyles = StyleSheet.create(withFont({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#0a0a0c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  iconBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0a0a0c",
  },
  count: { color: "#fff", fontSize: 12, fontWeight: "700", fontFamily: fontFamilyForWeight(700), flex: 1 },
  textBtn: { paddingHorizontal: 6 },
  textBtnLabel: { color: "#ffffff", fontSize: 11.5, fontWeight: "700", fontFamily: fontFamilyForWeight(700) },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: "#ef4444",
  },
  deleteLabel: { color: "#fff", fontSize: 11.5, fontWeight: "800", fontFamily: fontFamilyForWeight(800) },
  toggle: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: "#0a0a0c", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  toggleActive: {
    backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.45)",
  },
  toggleLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "700", fontFamily: fontFamilyForWeight(700), letterSpacing: 0.3 },
  toggleLabelActive: { color: "#ffffff" },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
    marginRight: 8,
  },
  dotSelected: {
    backgroundColor: "#ffffff", borderColor: "#ffffff",
  },
}));
