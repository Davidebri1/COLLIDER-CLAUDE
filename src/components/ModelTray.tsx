import React from "react";
import { View, Text, Pressable, ScrollView, LayoutAnimation } from "react-native";
import { useCollider } from "../state";
import { styles } from "../styles/theme";
import { MODELS, canUse } from "../models";

/**
 * Model chip strip. Shows colored pills for selected models above the card grid.
 * Tapping a chip deselects that model. Long-press opens the full selector drawer.
 * Matches the web UI chip tray exactly.
 */
export function ModelTray({
  openUpgrade,
  onOpenSelector,
  onToggleRows,
  onOpenAgentSkills,
  rows,
}: {
  openUpgrade: () => void;
  onOpenSelector: () => void;
  onToggleRows: () => void;
  onOpenAgentSkills: () => void;
  rows: 1 | 2 | 3;
}) {
  const { state, dispatch } = useCollider();
  const selectedModelIds = state.selectedModelIds[state.activeCategory];
  const selectedModels = MODELS.filter(
    (m) => selectedModelIds.includes(m.id) && m.category.includes(state.activeCategory)
  );

  if (selectedModels.length === 0) {
    return (
      <Pressable
        onPress={onOpenSelector}
        style={{
          flex: 1, height: 30,
          justifyContent: "center", alignItems: "flex-start",
        }}
      >
        <Text style={{ fontSize: 11, color: "#6b6478", fontWeight: "600" }}>
          + Add models
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1, height: 30 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", gap: 6 }}
      >
        {selectedModels.map((model) => {
          const usable = canUse(state.tier, model);
          return (
            <Pressable
              key={model.id}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                dispatch({ type: "toggleModel", category: state.activeCategory, modelId: model.id });
              }}
              onLongPress={onOpenSelector}
              style={{
                height: 28,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: model.color,
                alignItems: "center",
                justifyContent: "center",
                opacity: usable ? 1 : 0.45,
                shadowColor: model.color,
                shadowOpacity: 0.5,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Text style={{ color: "#000", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 }}>
                {model.short}
              </Text>
            </Pressable>
          );
        })}
        {/* Add model chip */}
        <Pressable
          onPress={onOpenSelector}
          style={{
            height: 28,
            paddingHorizontal: 10,
            borderRadius: 14,
            backgroundColor: "#0a0a0c",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: "300" }}>+</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
