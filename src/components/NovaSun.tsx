import React from "react";
import { Pressable, View, Image, type ImageSourcePropType } from "react-native";

const CANDIDATES = {
  gold: require("../../assets/ui/collide_btn.png"),
  purple: require("../../assets/ui/collide_btn_v4.png"),
  purple2: require("../../assets/ui/collide_btn_v6.png"),
  v3: require("../../assets/ui/collide_btn_v3.png"),
};

export function NovaSun({ size = 52, onPress, candidate = "v3" }: { size?: number; onPress: () => void; candidate?: keyof typeof CANDIDATES }) {
  return (
    <Pressable onPress={onPress} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* No circular mask — the generated art (ring/orb, glow, whatever the
          final pick is) is already its own shape. Forcing it into a circle
          just crops the art. Shadow stays on this square wrapper. */}
      <View style={{ width: size, height: size, shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
        <Image
          source={CANDIDATES[candidate]}
          style={{ width: "100%", height: "100%", resizeMode: "contain" }}
        />
      </View>
    </Pressable>
  );
}
