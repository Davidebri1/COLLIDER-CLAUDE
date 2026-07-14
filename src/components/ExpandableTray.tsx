import React, { useState, useEffect, useRef } from "react";
import { Pressable, Text, LayoutAnimation, Platform, UIManager, DeviceEventEmitter } from "react-native";
import * as Haptics from "expo-haptics";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function ExpandableTrayText({ text, style }: { text: string; style?: any }) {
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("global_tap", () => {
      if (expanded) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(false);
      }
    });

    if (expanded) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(false);
      }, 5000);
    }

    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [expanded]);

  const toggle = (e: any) => {
    e.stopPropagation(); // prevent global_tap from firing immediately and closing it
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <Pressable onPress={toggle} style={{ width: "100%", flexShrink: 1 }}>
      <Text style={style} numberOfLines={expanded ? undefined : 1} ellipsizeMode="clip">
        {text}
      </Text>
    </Pressable>
  );
}
