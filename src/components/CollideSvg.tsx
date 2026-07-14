import React from "react";
import Svg, { Circle, Defs, RadialGradient, Stop, G, Path } from "react-native-svg";

export function CollideSvg({ size = 52 }: { size?: number }) {
  const center = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        {/* Core Glowing Orb Gradient */}
        <RadialGradient id="coreOrb" cx="50%" cy="50%" rx="50%" ry="50%" fx="30%" fy="30%">
          <Stop offset="0%" stopColor="#fff9e6" />
          <Stop offset="25%" stopColor="#ffb74d" />
          <Stop offset="70%" stopColor="#ff5722" />
          <Stop offset="100%" stopColor="#673ab7" stopOpacity={0.9} />
        </RadialGradient>
        {/* Glossy Overlay Highlight */}
        <RadialGradient id="gloss" cx="50%" cy="15%" rx="40%" ry="25%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.6} />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Background Outer Glow Ring */}
      <Circle cx="50" cy="50" r="46" stroke="#ffb74d" strokeWidth="1.5" opacity={0.3} />
      <Circle cx="50" cy="50" r="42" stroke="#673ab7" strokeWidth="1" opacity={0.4} />

      {/* Main 3D Spherical Orb */}
      <Circle cx="50" cy="50" r="38" fill="url(#coreOrb)" />

      {/* Dynamic Overlapping Orbiting Energy Rings (Intersecting Light) */}
      <G stroke="#ffffff" strokeWidth="1.5" opacity={0.7}>
        {/* Ring 1 */}
        <Path d="M 22,35 C 35,20 65,20 78,35 C 90,50 90,65 78,80 C 65,95 35,95 22,80 C 10,65 10,50 22,35 Z" fill="none" opacity={0.25} />
        {/* Ring 2 (Intersecting angle) */}
        <Path d="M 22,65 C 10,50 10,35 22,20 C 35,5 65,5 78,20 C 90,35 90,50 78,65 C 65,80 35,80 22,65 Z" fill="none" opacity={0.25} />
      </G>

      {/* Spherical Gloss overlay */}
      <Circle cx="50" cy="50" r="38" fill="url(#gloss)" />

      {/* Center glowing focal point */}
      <Circle cx="50" cy="50" r="6" fill="#ffffff" opacity={0.9} />
    </Svg>
  );
}
