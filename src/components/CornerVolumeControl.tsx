// Persistent corner volume/mute control (SPEC.md: "always reachable
// regardless of what screen is open"). Rendered once at the Shell root, not
// per-screen — only visible once a track is actually playing, since it has
// nothing to control otherwise.
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCollider } from "../state";
import * as player from "../services/musicPlayer";

export function CornerVolumeControl() {
  const { state, dispatch } = useCollider();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const { trackId, isPlaying, volume, muted } = state.musicPlayer;

  useEffect(() => {
    if (muted) player.setVolume(0);
    else player.setVolume(volume);
  }, [volume, muted]);

  if (!trackId) return null;

  const icon = muted || volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high";

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, right: 8, zIndex: 999, alignItems: "flex-end" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,8,16,0.75)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 6, paddingVertical: 6 }}>
        {expanded && (
          <>
            <Pressable
              onPress={() => { isPlaying ? (player.pauseTrack(), dispatch({ type: "pausePlayer" })) : (player.resumeTrack(), dispatch({ type: "resumePlayer" })); }}
              style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={15} color="#fff" />
            </Pressable>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <Pressable
                key={v}
                onPress={() => dispatch({ type: "setPlayerVolume", volume: v })}
                style={{ width: 6, height: 18, borderRadius: 3, backgroundColor: !muted && volume >= v ? "#ffffff" : "rgba(255,255,255,0.15)" }}
              />
            ))}
          </>
        )}
        <Pressable
          onPress={() => dispatch({ type: "togglePlayerMute" })}
          onLongPress={() => setExpanded((v) => !v)}
          style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={icon as any} size={16} color={muted ? "#6b6478" : "#fff"} />
        </Pressable>
      </View>
    </View>
  );
}
