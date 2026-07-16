// Cross-platform dropdown. Previously rendered a raw HTML <select> on web —
// functionally fine, but its open list is OS-chrome (can't be styled),
// which read as flat/cheap against the app's dark-glass 2.5D aesthetic.
// Now uses the same custom BlurView sheet on every platform: consistent,
// on-brand, and no crash risk since it was never RN-native to begin with.
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type Option = { label: string; value: string };

export function Picker({
  value,
  onChange,
  options,
  style,
  textStyle,
  hideTrigger,
  controlledOpen,
  onRequestClose,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  style?: any;
  textStyle?: any;
  // For callers that trigger the list from their own external button (e.g. a
  // filter icon elsewhere in the row) — skip rendering this component's own
  // label+chevron trigger, and drive open/close from the parent instead of
  // needing a first tap to reveal this trigger, then a second to open the list.
  hideTrigger?: boolean;
  controlledOpen?: boolean;
  onRequestClose?: () => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : openState;
  const close = () => { setOpenState(false); onRequestClose?.(); };
  const current = options.find((o) => o.value === value);

  return (
    <>
      {!hideTrigger && (
        <Pressable
          onPress={() => setOpenState(true)}
          style={[{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4 }, style]}
        >
          <Text style={[{ color: "#fff", fontSize: 12, fontWeight: "700" }, textStyle]} numberOfLines={1}>{current?.label || value}</Text>
          <Ionicons name="chevron-down" size={11} color="#6b6478" />
        </Pressable>
      )}
      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}
          onPress={close}
        >
          <BlurView
            intensity={40}
            tint="dark"
            style={{
              borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "62%",
              overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
              shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 16,
            }}
          >
            <LinearGradient
              colors={["rgba(28,26,36,0.92)", "rgba(10,9,14,0.96)"]}
              style={{ paddingTop: 10 }}
            >
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", alignSelf: "center", marginBottom: 10 }} />
              <ScrollView bounces={false}>
                {options.map((o) => {
                  const selected = o.value === value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => { onChange(o.value); close(); }}
                      style={{
                        paddingHorizontal: 20, paddingVertical: 14,
                        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                        backgroundColor: selected ? "rgba(255,255,255,0.08)" : "transparent",
                        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? "#ffffff" : "rgba(255,255,255,0.85)",
                          fontSize: 14, fontWeight: selected ? "800" : "500",
                          textShadowColor: selected ? "rgba(255,255,255,0.4)" : "transparent",
                          textShadowRadius: selected ? 8 : 0,
                        }}
                      >
                        {o.label}
                      </Text>
                      {selected && <Ionicons name="checkmark-circle" size={17} color="#ffffff" />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </LinearGradient>
          </BlurView>
        </Pressable>
      </Modal>
    </>
  );
}
