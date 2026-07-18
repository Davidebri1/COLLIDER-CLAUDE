import React, { useState } from "react";
import { View, TextInput, Pressable, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCollider, type Attachment } from "../state";
import { pickImage, startRecording, stopRecording } from "../services/media";
import { transcribeAudio } from "../services/chat";
import { styles } from "../styles/theme";

export function PromptComposer({
  value,
  setValue,
  onSend,
  sending,
  attachments: propsAttachments,
  setAttachments: propsSetAttachments,
  onNewConversation,
}: {
  value: string;
  setValue: (v: string) => void;
  onSend: (attachments?: Attachment[]) => void;
  sending?: boolean;
  attachments?: Attachment[];
  setAttachments?: any;
  onNewConversation?: () => void;
}) {
  const { state, dispatch } = useCollider();
  const cat = state.activeCategory;
  const mode = state.chatMode[cat];
  const webSearch = state.webSearch[cat];
  const incognito = !!state.incognito[cat];
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>([]);
  const attachments = propsAttachments !== undefined ? propsAttachments : localAttachments;
  const setAttachments = propsSetAttachments !== undefined ? propsSetAttachments : setLocalAttachments;
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const nextMode = () => {
    Haptics.selectionAsync().catch(() => {});
    const order: ("default" | "research" | "deep")[] = ["default", "research", "deep"];
    const i = order.indexOf(mode);
    dispatch({ type: "chatMode", category: cat, mode: order[(i + 1) % order.length] });
  };

  const attach = async () => {
    Haptics.selectionAsync().catch(() => {});
    const img = await pickImage();
    if (!img) return;
    setAttachments((a: Attachment[]) => [...a, { kind: "image", dataUri: img.dataUri, mime: img.mime }]);
    dispatch({ type: "file", file: { name: `attach-${Date.now().toString(36)}.jpg`, kind: "uploaded", url: img.dataUri.slice(0, 200) } });
  };

  const toggleMic = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (!recording) {
      const ok = await startRecording();
      if (ok) setRecording(true);
      return;
    }
    setRecording(false);
    setTranscribing(true);
    try {
      const clip = await stopRecording();
      if (clip) {
        const text = await transcribeAudio(clip.uri, clip.mime);
        if (text) setValue(value ? `${value} ${text}` : text);
      }
    } catch (e) {
      // silent
    } finally {
      setTranscribing(false);
    }
  };

  const handleSend = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSend(attachments);
    setAttachments([]);
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !sending;
  const modeColor = mode === "deep" ? "#ffb74d" : mode === "research" ? "#5dbdff" : "#6b6478";

  return (
    <View style={styles.composer}>
      {attachments.length > 0 && (
        <View style={{ flexDirection: "row", gap: 6, paddingBottom: 10, flexWrap: "wrap" }}>
          {attachments.map((a, i) => (
            <Pressable
              key={i}
              onPress={() => setAttachments((x: Attachment[]) => x.filter((_, k) => k !== i))}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 10,
                backgroundColor: "#0a0a0c",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <Ionicons name="image-outline" size={12} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "600" }}>Image {i + 1}</Text>
              <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.4)" />
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={transcribing ? "Transcribing voice..." : recording ? "Listening..." : "Ask anything or collide minds..."}
        placeholderTextColor="#4a4554"
        multiline
        style={styles.input}
      />

      <View style={styles.toolRow}>
        {/* New conversation — lives here, not in a header, since it acts on
            what the composer is about to send into. */}
        {onNewConversation && (
          <Pressable onPress={onNewConversation} style={styles.toolBtn}>
            <Ionicons name="add" size={15} color="#6b6478" />
          </Pressable>
        )}

        {/* Attachment Paperclip Button */}
        <Pressable onPress={attach} style={styles.toolBtn}>
          <Ionicons name="attach-outline" size={15} color="#6b6478" />
        </Pressable>

        {/* Voice Recorder Mic Button */}
        <Pressable
          onPress={toggleMic}
          style={[styles.toolBtn, recording && { backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }]}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color="#6b6478" />
          ) : recording ? (
            <Ionicons name="mic" size={14} color="#ef4444" />
          ) : (
            <Ionicons name="mic-outline" size={14} color="#6b6478" />
          )}
        </Pressable>

        {/* Private (Incognito) Mode Toggle */}
        <Pressable
          onPress={() => dispatch({ type: "incognito", category: cat, enabled: !incognito })}
          style={[styles.toolBtn, incognito && { backgroundColor: "rgba(93,189,255,0.15)", borderWidth: 1, borderColor: "rgba(93,189,255,0.3)" }]}
        >
          <Ionicons name={incognito ? "eye-off" : "eye-off-outline"} size={14} color={incognito ? "#5dbdff" : "#6b6478"} />
        </Pressable>

        {/* Web Search Globe Toggle — was #10b981 green, a decorative color
            outside the black/white/crimson/orange palette; orange matches
            the app's established second accent instead. */}
        <Pressable
          onPress={() => dispatch({ type: "webSearch", category: cat, enabled: !webSearch })}
          style={[styles.toolBtn, webSearch && { backgroundColor: "rgba(255,183,77,0.15)", borderWidth: 1, borderColor: "rgba(255,183,77,0.3)" }]}
        >
          <Ionicons name={webSearch ? "globe" : "globe-outline"} size={14} color={webSearch ? "#ffb74d" : "#6b6478"} />
        </Pressable>

        {/* Model Mode dropdown chip — matches web 'Default ▾' pill.
            NOTE: react-native-web doesn't reliably "unset" a style property
            with `width: undefined` (the base toolBtn's fixed width can win
            depending on atomic-class insertion order) — must override with
            an explicit value like "auto" instead. */}
        <Pressable
          onPress={nextMode}
          style={[styles.toolBtn, { width: "auto", minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, flexDirection: "row", gap: 3, alignItems: "center", backgroundColor: "#0a0a0c", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }]}
        >
          <Text style={{ color: modeColor, fontSize: 9, fontWeight: "700" }}>
            {mode === "default" ? "Default" : mode === "research" ? "Research" : "Deep"}
          </Text>
          <Ionicons name="chevron-down" size={9} color={modeColor} />
        </Pressable>

        {/* Send Arrow Circle Button */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[
            styles.send,
            !canSend && { opacity: 0.35 },
            canSend && { backgroundColor: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.38)" },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-up" size={15} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
