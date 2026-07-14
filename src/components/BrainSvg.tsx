import React from "react";
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G } from "react-native-svg";

export function BrainSvg({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        {/* Pink/Silver Chrome Gradient for the main outline */}
        <LinearGradient id="chromePink" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#ff79c6" stopOpacity={0.9} />
          <Stop offset="30%" stopColor="#f8f8f2" stopOpacity={0.95} />
          <Stop offset="50%" stopColor="#bd93f9" stopOpacity={0.8} />
          <Stop offset="70%" stopColor="#ff79c6" stopOpacity={0.9} />
          <Stop offset="100%" stopColor="#8be9fd" stopOpacity={0.95} />
        </LinearGradient>
        {/* Glow gradient for neural nodes */}
        <LinearGradient id="nodeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#ffb86c" />
          <Stop offset="100%" stopColor="#ff5555" />
        </LinearGradient>
      </Defs>

      {/* Main Brain Lobes (Stylized vector paths) */}
      <G stroke="url(#chromePink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* Left Hemisphere */}
        <Path d="M 50,20 C 35,20 25,30 25,45 C 25,52 30,58 35,62 C 30,68 32,76 40,78 C 45,80 50,75 50,70" />
        <Path d="M 35,45 C 38,48 43,45 46,40" />
        <Path d="M 28,55 C 34,57 38,52 40,48" />
        
        {/* Right Hemisphere */}
        <Path d="M 50,20 C 65,20 75,30 75,45 C 75,52 70,58 65,62 C 70,68 68,76 60,78 C 55,80 50,75 50,70" />
        <Path d="M 65,45 C 62,48 57,45 54,40" />
        <Path d="M 72,55 C 66,57 62,52 60,48" />

        {/* Central Lobe divisions */}
        <Path d="M 50,20 L 50,70" />
      </G>

      {/* Neural Pathway Connections (futuristic nodes and links) */}
      <G stroke="#ff79c6" strokeWidth="1" opacity={0.6} strokeDasharray="2,2">
        <Path d="M 35,35 L 50,45 L 65,35" />
        <Path d="M 30,50 L 50,55 L 70,50" />
        <Path d="M 40,70 L 50,55 L 60,70" />
      </G>

      {/* Glowing Neural Nodes */}
      <G>
        <Circle cx="35" cy="35" r="3.5" fill="url(#nodeGlow)" />
        <Circle cx="65" cy="35" r="3.5" fill="url(#nodeGlow)" />
        <Circle cx="50" cy="45" r="4" fill="#bd93f9" />
        <Circle cx="30" cy="50" r="3" fill="#8be9fd" />
        <Circle cx="70" cy="50" r="3" fill="#8be9fd" />
        <Circle cx="50" cy="55" r="3.5" fill="url(#nodeGlow)" />
        <Circle cx="40" cy="70" r="3" fill="#ff79c6" />
        <Circle cx="60" cy="70" r="3" fill="#ff79c6" />
      </G>
    </Svg>
  );
}
