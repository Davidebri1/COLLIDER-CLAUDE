import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { GlossSurface } from "./GlossSurface";

// A wide flat banner sized to match the composer directly below it, docked
// flush against its top edge — no gap, reads as one continuous surface with
// the composer rather than a separate floating bar. Tapping it, or dragging
// it upward, opens the full-screen Consensus drawer via `onPress` (RN's
// Pressable still fires onPress on release even after a vertical drag,
// since nothing else here claims the touch responder — no separate
// PanResponder needed for the two gestures to do the same thing). Global
// view only; card view has no Collide entry point.
export function CollideBanner({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <View style={{ marginHorizontal: 14, marginTop: 2, alignItems: "center" }}>
      {/* The protruding post — a small tab sticking up above the banner's
          own top edge, so the banner reads as "docked onto" something
          rather than just another bar. Plain gloss, no icon on it — the
          collide mark asset read as a webcam lens, which undercut the
          concept rather than supporting it. */}
      <View style={styles.post}>
        <GlossSurface borderRadius={9} />
      </View>

      <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} style={[styles.banner, disabled && { opacity: 0.4 }]}>
        <GlossSurface borderRadius={16} />
        <Text style={styles.title}>COLLIDE</Text>
        <Text style={styles.sub}>{disabled ? "Select 2+ models to compare" : "Tap or drag up for consensus"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    width: 40,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#020202",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -9,
    zIndex: 2,
    shadowColor: "#ffffff",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  banner: {
    width: "100%",
    height: 40,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  // Deliberately NOT the same treatment as the "COLLIDER" app title (white,
  // fontWeight 900, letterSpacing 3) — that similarity was exactly why this
  // read as another header instead of a button: same look, different job.
  // The app's one fixed accent (silver/chrome) marks it as the interactive
  // element it is.
  title: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  // Not fine print — this line carries real information (what tapping does,
  // or why it's disabled), not decoration, so it needs to actually be
  // readable, not shrunk down to an afterthought.
  sub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
});
