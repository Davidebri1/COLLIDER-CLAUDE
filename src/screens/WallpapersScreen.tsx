import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ImageBackground
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import * as Haptics from "expo-haptics";
import { useCollider } from "../state";
import { Glass } from "../components/Glass";
import { Page } from "../components/Page";
import { styles, WALLPAPERS, FREE_THEMES, PREMIUM_THEMES } from "../styles/theme";
import { useToast } from "../components/Toast";

export function WallpapersScreen({ goBack }: { goBack: () => void }) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();
  const canUsePremium = state.tier !== "free";

  const SELECTED_BORDER = "#a78bfa"; // Unified gold border
  const LOCK_COLOR = "#c4b5fd";

  const handleSelectWallpaper = (wId: string, requiresPro?: boolean) => {
    if (requiresPro && !canUsePremium) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast("Live video wallpapers require a Pro or Elite subscription. Upgrade to unlock.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dispatch({ type: "wallpaper", wallpaper: wId });
  };

  const isSelected = (id: string) => state.wallpaper === id;

  return (
    <Page title="Theme Wallpapers" goBack={goBack}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Preset colorscapes ── */}
        <View style={wallStyles.sectionHead}>
          <Text style={wallStyles.sectionLabel}>PRESET COLORSCAPES</Text>
          <Text style={wallStyles.sectionHint}>{WALLPAPERS.length} preset gradients</Text>
        </View>
        <View style={styles.grid}>
          {WALLPAPERS.map((wall) => {
            const active = isSelected(wall.id);
            return (
              <Pressable
                key={wall.id}
                onPress={() => handleSelectWallpaper(wall.id, wall.premium)}
                style={{ width: "47%", marginBottom: 12 }}
              >
                <Glass
                  style={[
                    styles.wallTile,
                    { padding: 0, overflow: "hidden", height: 110, borderRadius: 16 },
                    active && { borderColor: SELECTED_BORDER, borderWidth: 1.5, shadowColor: SELECTED_BORDER, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
                  ]}
                >
                  <LinearGradient colors={wall.colors} style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={["transparent", "rgba(0,0,0,0.5)"]} style={StyleSheet.absoluteFill} />
                  
                  <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.tileName, { fontSize: 11, fontWeight: "800", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]}>{wall.name}</Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={14} color="#a78bfa" />
                    ) : wall.premium && !canUsePremium ? (
                      <Ionicons name="lock-closed" size={12} color={LOCK_COLOR} />
                    ) : null}
                  </View>
                </Glass>
              </Pressable>
            );
          })}
        </View>

        {/* ── Free image themes (drop-in) ── */}
        <View style={wallStyles.sectionHead}>
          <Text style={wallStyles.sectionLabel}>FREE STATIC IMAGES</Text>
          <Text style={wallStyles.sectionHint}>{FREE_THEMES.length} loaded</Text>
        </View>
        
        {/* Terminal styled instructions */}
        <View style={wallStyles.terminalContainer}>
          <View style={wallStyles.terminalHeader}>
            <View style={wallStyles.terminalDotRed} />
            <View style={wallStyles.terminalDotYellow} />
            <View style={wallStyles.terminalDotGreen} />
            <Text style={wallStyles.terminalTitle}>assets.sh // import instructions</Text>
          </View>
          <Text style={wallStyles.terminalText}>
            $ cp my_theme.jpg assets/themes/free/{"\n"}
            $ npm run reload # themes auto-load in real-time
          </Text>
        </View>

        {FREE_THEMES.length === 0 ? (
          <Text style={localStyles.mutedHint}>Drop custom .jpg assets in your project root to show themes here.</Text>
        ) : (
          <View style={styles.grid}>
            {FREE_THEMES.map((theme) => {
              const active = isSelected(theme.id);
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => handleSelectWallpaper(theme.id, false)}
                  style={{ width: "47%", marginBottom: 12 }}
                >
                  <Glass
                    style={[
                      styles.wallTile,
                      { padding: 0, overflow: "hidden", height: 110, borderRadius: 16 },
                      active && { borderColor: SELECTED_BORDER, borderWidth: 1.5 },
                    ]}
                  >
                    <ImageBackground source={theme.source} style={StyleSheet.absoluteFill} imageStyle={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
                    
                    <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.tileName, { fontSize: 11, fontWeight: "800", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]}>{theme.name}</Text>
                      {active && <Ionicons name="checkmark-circle" size={14} color="#a78bfa" />}
                    </View>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Premium live wallpapers (drop-in video) ── */}
        <View style={wallStyles.sectionHead}>
          <Text style={wallStyles.sectionLabel}>PREMIUM LIVE VIDEOS</Text>
          <Text style={[wallStyles.sectionHint, { color: LOCK_COLOR }]}>{PREMIUM_THEMES.length} files · Pro+</Text>
        </View>

        <View style={[wallStyles.terminalContainer, { borderColor: "rgba(196,181,253,0.18)", backgroundColor: "rgba(196,181,253,0.02)" }]}>
          <View style={wallStyles.terminalHeader}>
            <View style={wallStyles.terminalDotRed} />
            <View style={wallStyles.terminalDotYellow} />
            <View style={wallStyles.terminalDotGreen} />
            <Text style={[wallStyles.terminalTitle, { color: "#c4b5fd" }]}>live_wallpapers.sh // video compilation</Text>
          </View>
          <Text style={[wallStyles.terminalText, { color: "#c4b5fd" }]}>
            $ mv loops.mp4 assets/themes/premium/{"\n"}
            $ metro restart # compiles assets in 60fps loops
          </Text>
        </View>

        {!canUsePremium && (
          <View style={wallStyles.proBanner}>
            <Ionicons name="lock-closed" size={14} color="#a78bfa" style={{ marginRight: 6 }} />
            <Text style={wallStyles.proBannerText}>Live loops unlock with Pro or Elite subscription tiers.</Text>
          </View>
        )}

        {PREMIUM_THEMES.length === 0 ? (
          <Text style={localStyles.mutedHint}>Drop custom .mp4 files into assets/themes/premium/ to unlock video backdrops.</Text>
        ) : (
          <View style={styles.grid}>
            {PREMIUM_THEMES.map((theme) => {
              const active = isSelected(theme.id);
              return (
                <Pressable
                  key={theme.id}
                  onPress={() => handleSelectWallpaper(theme.id, true)}
                  style={{ width: "47%", marginBottom: 12 }}
                >
                  <Glass
                    style={[
                      styles.wallTile,
                      { padding: 0, overflow: "hidden", height: 110, borderRadius: 16 },
                      active && { borderColor: SELECTED_BORDER, borderWidth: 1.5 },
                      !canUsePremium && { opacity: 0.55 },
                    ]}
                  >
                    <Video
                      source={theme.source}
                      rate={1.0}
                      volume={0.0}
                      isMuted
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={active && canUsePremium}
                      isLooping
                      style={StyleSheet.absoluteFill}
                      videoStyle={{ width: "100%", height: "100%" } as any}
                    />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
                    
                    <View style={wallStyles.liveBadge}>
                      <Text style={wallStyles.liveText}>● VIDEO</Text>
                    </View>
                    
                    <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={[styles.tileName, { fontSize: 11, fontWeight: "800", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]}>{theme.name}</Text>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={14} color="#a78bfa" />
                      ) : !canUsePremium ? (
                        <Ionicons name="lock-closed" size={12} color={LOCK_COLOR} />
                      ) : null}
                    </View>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Page>
  );
}

const localStyles = StyleSheet.create({
  mutedHint: {
    color: "#6b6478",
    fontSize: 10.5,
    textAlign: "center",
    marginVertical: 14,
    marginHorizontal: 8,
    lineHeight: 16,
  }
});

// Overriding wallStyles for AAA presentation
const wallStyles = StyleSheet.create({
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    color: "#858091",
    fontSize: 9.5,
    letterSpacing: 2,
    fontWeight: "900",
  },
  sectionHint: {
    color: "#6b6478",
    fontSize: 10.5,
  },
  terminalContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  terminalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
    paddingBottom: 6,
  },
  terminalDotRed: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#ef4444" },
  terminalDotYellow: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#eab308" },
  terminalDotGreen: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#22c55e" },
  terminalTitle: {
    color: "#6b6478",
    fontSize: 8,
    fontFamily: "monospace",
    marginLeft: 4,
  },
  terminalText: {
    color: "#8d8398",
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "monospace",
  },
  liveBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  liveText: {
    color: "#a78bfa",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  proBanner: {
    backgroundColor: "rgba(167, 139, 250, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  proBannerText: {
    color: "#a78bfa",
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
