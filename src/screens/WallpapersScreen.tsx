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
import { styles, WALLPAPERS, FREE_THEMES, PREMIUM_THEMES, withFont } from "../styles/theme";
import { useToast } from "../components/Toast";
import * as player from "../services/musicPlayer";

export function WallpapersScreen({ goBack }: { goBack: () => void }) {
  const { state, dispatch } = useCollider();
  const { toast } = useToast();

  const SELECTED_BORDER = "#e2e8f0"; // Silver/chrome — the app's active/selected accent, not a hue
  const LOCK_COLOR = "#6b6478"; // Locked/disabled is a legitimate desaturated case, not a soft-purple one
  // Preset gradient colorscapes: a plain Pro/Elite tier perk (unrelated to
  // the per-item purchase model below, which is specifically for live video
  // wallpapers — a static gradient isn't the thing SPEC.md's individual
  // $2.99–$7.99 pricing is about).
  const canUsePremium = state.tier !== "free";

  // Live wallpapers are gated per-item by purchase, not by tier (spec: "not
  // unlocked in bulk by Pro/Elite tier alone" — each is its own $2.99–$7.99
  // purchase). This is a MOCK purchase (adds to ownedWallpaperIds locally) —
  // no real IAP is wired in. Real billing (react-native-iap, App Store/Play
  // Store product config, receipt validation) needs explicit sign-off before
  // it touches actual money; this scaffolds everything else (data model,
  // gating UI, player) so that's a drop-in swap later, not a rebuild.
  const isOwned = (id: string) => state.ownedWallpaperIds.includes(id);

  const handleSelectWallpaper = (wId: string, locked?: boolean) => {
    if (locked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast("This wallpaper is locked. Upgrade or purchase to use it.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dispatch({ type: "wallpaper", wallpaper: wId });
  };

  const handlePurchase = (wId: string, price?: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    dispatch({ type: "purchaseWallpaper", wallpaperId: wId });
    toast(`Purchased for ${price || "the listed price"} (mock — no real charge).`);
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
                onPress={() => handleSelectWallpaper(wall.id, wall.premium && !canUsePremium)}
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
                      <Ionicons name="checkmark-circle" size={14} color="#e2e8f0" />
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
                      {active && <Ionicons name="checkmark-circle" size={14} color="#e2e8f0" />}
                    </View>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Premium live wallpapers (individual purchase, per spec) ── */}
        <View style={wallStyles.sectionHead}>
          <Text style={wallStyles.sectionLabel}>PREMIUM LIVE WALLPAPERS</Text>
          <Text style={[wallStyles.sectionHint, { color: LOCK_COLOR }]}>{PREMIUM_THEMES.length} available · own individually</Text>
        </View>

        <View style={[wallStyles.terminalContainer, { borderColor: "rgba(196,181,253,0.18)", backgroundColor: "rgba(196,181,253,0.02)" }]}>
          <View style={wallStyles.terminalHeader}>
            <View style={wallStyles.terminalDotRed} />
            <View style={wallStyles.terminalDotYellow} />
            <View style={wallStyles.terminalDotGreen} />
            <Text style={[wallStyles.terminalTitle, { color: "#e2e8f0" }]}>live_wallpapers.sh // video compilation</Text>
          </View>
          <Text style={[wallStyles.terminalText, { color: "#e2e8f0" }]}>
            $ mv loops.mp4 assets/themes/premium/{"\n"}
            $ metro restart # compiles assets in 60fps loops
          </Text>
        </View>

        {PREMIUM_THEMES.length === 0 ? (
          <Text style={localStyles.mutedHint}>Drop custom .mp4 files into assets/themes/premium/ to unlock video backdrops.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {PREMIUM_THEMES.map((theme) => {
              const active = isSelected(theme.id);
              const owned = isOwned(theme.id);
              const { trackId: playingTrackId, isPlaying } = state.musicPlayer;
              return (
                <View key={theme.id}>
                  <Pressable onPress={() => handleSelectWallpaper(theme.id, !owned)}>
                    <Glass
                      style={[
                        styles.wallTile,
                        { padding: 0, overflow: "hidden", height: 130, borderRadius: 16 },
                        active && { borderColor: SELECTED_BORDER, borderWidth: 1.5 },
                        !owned && { opacity: 0.6 },
                      ]}
                    >
                      <Video
                        source={theme.source}
                        rate={1.0}
                        volume={0.0}
                        isMuted
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={active && owned}
                        isLooping
                        style={StyleSheet.absoluteFill}
                        videoStyle={{ width: "100%", height: "100%" } as any}
                      />
                      <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />

                      <View style={wallStyles.liveBadge}>
                        <Text style={wallStyles.liveText}>● VIDEO</Text>
                      </View>

                      <View style={{ position: "absolute", bottom: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.tileName, { fontSize: 11, fontWeight: "800", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]}>{theme.name}</Text>
                          {!!theme.tracks?.length && (
                            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, marginTop: 1 }}>{theme.tracks.length} tracks included</Text>
                          )}
                        </View>
                        {active ? (
                          <Ionicons name="checkmark-circle" size={14} color="#e2e8f0" />
                        ) : !owned ? (
                          <Ionicons name="lock-closed" size={12} color={LOCK_COLOR} />
                        ) : null}
                      </View>
                    </Glass>
                  </Pressable>

                  {!owned ? (
                    <Pressable
                      onPress={() => handlePurchase(theme.id, theme.price)}
                      style={wallStyles.buyBtn}
                    >
                      <Ionicons name="cart-outline" size={13} color="#0a0512" />
                      <Text style={wallStyles.buyBtnText}>Own for {theme.price || "—"}</Text>
                    </Pressable>
                  ) : !!theme.tracks?.length && (
                    <View style={wallStyles.trackList}>
                      {theme.tracks.map((track) => {
                        const isThisPlaying = playingTrackId === track.id && isPlaying;
                        const disabled = state.musicPlayer.disabledTrackIds.includes(track.id);
                        return (
                          <View key={track.id} style={wallStyles.trackRow}>
                            <Pressable
                              onPress={() => {
                                if (disabled) return;
                                if (isThisPlaying) {
                                  player.pauseTrack();
                                  dispatch({ type: "pausePlayer" });
                                } else {
                                  player.playTrack(track.id, track.url, state.musicPlayer.muted ? 0 : state.musicPlayer.volume);
                                  dispatch({ type: "playTrack", trackId: track.id });
                                }
                              }}
                              disabled={disabled}
                              style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, opacity: disabled ? 0.4 : 1 }}
                            >
                              <Ionicons name={isThisPlaying ? "pause-circle" : "play-circle"} size={20} color="#e2e8f0" />
                              <Text style={wallStyles.trackTitle}>{track.title}</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                // Disabling a track that's currently playing
                                // must actually stop it — otherwise "off"
                                // only changes an icon while the audio keeps
                                // going, which isn't what toggling it off means.
                                if (!disabled && isThisPlaying) {
                                  player.pauseTrack();
                                  dispatch({ type: "pausePlayer" });
                                }
                                dispatch({ type: "toggleTrackEnabled", trackId: track.id });
                              }}
                            >
                              <Ionicons name={disabled ? "eye-off-outline" : "checkmark-circle"} size={16} color={disabled ? "#6b6478" : "#4be6b1"} />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
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
const wallStyles = StyleSheet.create(withFont({
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
    color: "#e2e8f0",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  buyBtnText: {
    color: "#0a0512",
    fontSize: 11.5,
    fontWeight: "800",
  },
  trackList: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    marginTop: 6,
    paddingVertical: 2,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  trackTitle: {
    color: "#e8e6eb",
    fontSize: 12,
  },
}));
