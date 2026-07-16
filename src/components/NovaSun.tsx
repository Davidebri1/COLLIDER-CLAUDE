import React, { useEffect, useRef } from "react";
import { Animated, Pressable, View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// The Collide button — a breathing violet ring with real animated sparks.
// Built from View + LinearGradient + Animated only. Skia was tried for this
// (true radial gradients, real blur) but its web build depends on fetching
// a canvaskit .wasm binary at runtime outside Metro's normal bundle graph —
// Metro's dev server 404s that request in this environment (confirmed via
// console: wasm fetch returns an HTML error page, not the binary), so it
// can't initialize on web here. This approach has none of that risk: proven
// to render and animate correctly all session.
//  1. Aura — fixed-size soft rings behind the core; only brightness breathes
//     (emittance, not scale).
//  2. Core — hot/cool gradient cross-fade, same emittance idea.
//  3. Sparks — thin gradient slivers that originate at the core's own edge
//     and fly outward into the aura, fading, each independently timed.
//     Slivers, not glitter dots. No separate icon/mark drawn on top of the
//     core — two same-size overlapping rings read as a face, not a mark, so
//     the breathing/spark animation is the whole identity instead.
function Spark({ size, angle, delay }: { size: number; angle: number; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 340, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);

  const opacity = t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });
  // Origin sits AT the core's edge (radius = size/2), not the button center —
  // starting from center meant the spark never left the bright core it's the
  // same color as, so it was animating invisibly on top of itself. Travel
  // continues further out from there, past the edge into the darker aura
  // where a bright sliver actually shows up against the background.
  const radius = size / 2;
  // Longer, thinner, square-ended (not fully rounded) — at the old length
  // (~13px) and full end-rounding, the streak had no visible direction and
  // read as a soft dot/sparkle instead of a line. This is long/thin/sharp
  // enough that the direction actually registers at a glance.
  const travel = t.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.5] });
  const length = size * 0.34;
  const rad = (angle * Math.PI) / 180;
  const originX = size / 2 + Math.cos(rad) * radius;
  const originY = size / 2 + Math.sin(rad) * radius;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: originX - length / 2,
        top: originY - 0.75,
        width: length,
        height: 1.5,
        opacity,
        transform: [
          { rotate: `${angle}deg` },
          { translateX: travel },
        ],
      }}
    >
      <LinearGradient
        colors={["#ffffff", "#e5e5e5", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: "100%", height: "100%" }}
      />
    </Animated.View>
  );
}

export function NovaSun({ size = 68, onPress }: { size?: number; onPress: () => void }) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 3400, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 3400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // Emittance pulse: brightness/opacity only, no scale change anywhere.
  const auraOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.7] });
  const hotOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const coolOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  const auraSizes = [size * 2.6, size * 2.0, size * 1.5];
  const auraOpacities = [0.06, 0.11, 0.2];

  const sparkAngles = [-50, 15, 95, 160, -115, 55, -10];

  return (
    <Pressable onPress={onPress} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Aura — fixed-size soft rings, brightness-only breathing */}
      <Animated.View style={{ position: "absolute", opacity: auraOpacity }} pointerEvents="none">
        {auraSizes.map((s, i) => (
          <View
            key={i}
            style={{
              position: "absolute", width: s, height: s, borderRadius: s / 2,
              left: -s / 2 + size / 2, top: -s / 2 + size / 2,
              backgroundColor: "#ffffff", opacity: auraOpacities[i],
            }}
          />
        ))}
      </Animated.View>

      {/* Sparks — thin bright slivers flaring outward, not soft dots */}
      <View style={{ position: "absolute", width: size, height: size }} pointerEvents="none">
        {sparkAngles.map((a, i) => (
          <Spark key={i} size={size} angle={a} delay={i * 260} />
        ))}
      </View>

      {/* Core — hot/cool gradient cross-fade, fixed size */}
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <Animated.View style={{ position: "absolute", width: "100%", height: "100%", opacity: coolOpacity }}>
          <LinearGradient
            colors={["#8a8a8a", "#1a1a1a"]}
            start={{ x: 0.3, y: 0.2 }}
            end={{ x: 1, y: 1 }}
            style={{ width: "100%", height: "100%" }}
          />
        </Animated.View>
        <Animated.View style={{ position: "absolute", width: "100%", height: "100%", opacity: hotOpacity }}>
          <LinearGradient
            colors={["#ffffff", "#e5e5e5"]}
            start={{ x: 0.3, y: 0.2 }}
            end={{ x: 1, y: 1 }}
            style={{ width: "100%", height: "100%" }}
          />
        </Animated.View>

        {/* Collide mark: a generated impact-burst image (two beams striking
            and erupting into light), not a hand-coded glyph — the earlier
            3-line asterisk was a placeholder shape, not a considered design.
            Chroma-keyed to real transparency (see collide_core_final.png's
            generation note) and composited small at the core's center. */}
        <Image
          source={require("../../assets/ui/collide_core_final.png")}
          pointerEvents="none"
          style={{ position: "absolute", width: size * 0.62, height: size * 0.62, left: size * 0.19, top: size * 0.19, resizeMode: "contain" }}
        />
      </View>
    </Pressable>
  );
}
