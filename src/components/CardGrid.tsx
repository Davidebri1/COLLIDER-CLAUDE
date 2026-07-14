import React from "react";
import { View, ScrollView, Text } from "react-native";
import { ChatMessage } from "../state";
import { ModelCard } from "./ModelCard";
import { styles, SCREEN_W } from "../styles/theme";
import { ModelDef } from "../models";

const GAP = 6;
const H_PAD = 10;
const V_PAD = 6; // ScrollView's own contentContainer paddingVertical, below

export function CardGrid({
  selected, openCard, openUpgrade, onLongPressCard, rows, gridHeight,
}: {
  selected: ModelDef[];
  openCard: (id: string) => void;
  openUpgrade: () => void;
  onLongPressCard: (msg: ChatMessage, modelId: string) => void;
  rows: 1 | 2 | 3;
  gridHeight: number;
}) {
  if (selected.length === 0) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: "transparent" }]}>
        <Text style={[styles.muted, { textAlign: "center", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]}>
          Tap MODELS to add models to the grid
        </Text>
      </View>
    );
  }

  // All cards in the grid are equal size (uniform), and `rows` (N) defines a
  // fixed N×N "page" (3 rows → up to 9 cards visible at once). Anything
  // beyond the first N² cards doesn't shrink cards further or cause vertical
  // scroll — it becomes additional columns, revealed by scrolling
  // horizontally (filled column-major: card N sits at the top of the
  // (N+1)th column, not appended to a partial row).
  const N = rows;
  const columns: ModelDef[][] = [];
  for (let i = 0; i < selected.length; i += N) columns.push(selected.slice(i, i + N));

  // Width divides by however many columns are actually on screen at once —
  // capped at N (the page width), never by N itself regardless of column
  // count. With fewer than N² cards selected (e.g. 6 cards at rows=3 → only
  // 2 columns), dividing by N would reserve a phantom empty column's worth
  // of width instead of letting the real columns grow to fill it.
  const visibleColumns = Math.max(1, Math.min(columns.length, N));
  const maxWidthFromW = Math.max(0, (SCREEN_W - H_PAD * 2 - (visibleColumns - 1) * GAP) / visibleColumns) - 2;
  const maxHeightFromH = Math.max(0, (gridHeight - V_PAD * 2 - (N - 1) * GAP) / N) - 2;
  // Cards are portrait with a fixed aspect ratio — they never widen past
  // this ratio even when vertical space is available. This is deliberate:
  // the grid is a custom, user-tuned area (density is the user's own
  // choice), not a "no dead space" zone like the header chrome is.
  const CARD_RATIO = 1.5; // height = width * ratio
  const cardWidth = Math.max(0, Math.min(maxWidthFromW, maxHeightFromH / CARD_RATIO));
  const cardHeight = cardWidth * CARD_RATIO;

  if (cardWidth <= 0 || cardHeight <= 0) return <View />;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: H_PAD, paddingVertical: 6, flexDirection: "row", gap: GAP }}
    >
      {columns.map((col, colIdx) => (
        <View key={colIdx} style={{ flexDirection: "column", gap: GAP }}>
          {col.map((model) => (
            <View key={model.id} style={{ width: cardWidth, height: cardHeight }}>
              <ModelCard
                model={model}
                open={() => openCard(model.id)}
                openUpgrade={openUpgrade}
                onLongPress={(msg) => onLongPressCard(msg, model.id)}
                height={cardHeight}
              />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
