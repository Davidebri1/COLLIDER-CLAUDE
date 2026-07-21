import React, { useState } from "react";
import { View, TextInput, Pressable, Text, ActivityIndicator, Modal, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCollider, type Attachment } from "../state";
import { pickImage, startRecording, stopRecording } from "../services/media";
import { transcribeAudio } from "../services/chat";
import { styles, fontFamilyForWeight } from "../styles/theme";

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
  onSend: (attachments?: Attachment[], compiledText?: string) => void;
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

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [imageSettings, setImageSettings] = useState({
    ar: "1:1",
    quality: "standard",
    style: "neutral",
    negative: "",
  });
  const [videoSettings, setVideoSettings] = useState({
    ar: "16:9",
    quality: "standard",
    duration: "4",
    motion: "medium",
  });
  const [musicSettings, setMusicSettings] = useState({
    vocals: "vocal",
    quality: "standard",
    format: "mp3",
    tags: "",
  });

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
    
    let compiledPrompt = value.trim();
    if (cat === "image") {
      compiledPrompt += ` --ar ${imageSettings.ar} --quality ${imageSettings.quality} --style ${imageSettings.style}`;
      if (imageSettings.negative.trim()) {
        compiledPrompt += ` --negative "${imageSettings.negative.trim()}"`;
      }
    } else if (cat === "video") {
      compiledPrompt += ` --ar ${videoSettings.ar} --quality ${videoSettings.quality} --duration ${videoSettings.duration} --motion ${videoSettings.motion}`;
    } else if (cat === "music") {
      compiledPrompt += ` --vocals ${musicSettings.vocals} --bitrate ${musicSettings.quality} --format ${musicSettings.format}`;
      if (musicSettings.tags.trim()) {
        compiledPrompt += ` --tags "${musicSettings.tags.trim()}"`;
      }
    }

    onSend(attachments, compiledPrompt);
    setAttachments([]);
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !sending;
  const modeColor = mode === "deep" ? "#f5e000" : mode === "research" ? "#5dbdff" : "rgba(238,241,246,0.55)"; // deep was orange/gold — banned accent per SPEC.md; true yellow instead

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
                backgroundColor: "rgba(255,255,255,0.04)",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <Ionicons name="image-outline" size={12} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "600", fontFamily: fontFamilyForWeight(600) }}>Image {i + 1}</Text>
              <Ionicons name="close-circle" size={13} color="rgba(255,255,255,0.4)" />
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={transcribing ? "Transcribing voice..." : recording ? "Listening..." : "Ask anything or collide minds..."}
        placeholderTextColor="rgba(238,241,246,0.3)"
        multiline
        style={styles.input}
      />

      <View style={styles.toolRow}>
        {/* New conversation — lives here, not in a header, since it acts on
            what the composer is about to send into. */}
        {onNewConversation && (
          <Pressable onPress={onNewConversation} style={styles.toolBtn}>
            <Ionicons name="add" size={15} color="rgba(238,241,246,0.55)" />
          </Pressable>
        )}

        {/* Attachment Paperclip Button */}
        <Pressable onPress={attach} style={styles.toolBtn}>
          <Ionicons name="attach-outline" size={15} color="rgba(238,241,246,0.55)" />
        </Pressable>

        {/* Voice Recorder Mic Button */}
        <Pressable
          onPress={toggleMic}
          style={[styles.toolBtn, recording && { backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }]}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color="rgba(238,241,246,0.55)" />
          ) : recording ? (
            <Ionicons name="mic" size={14} color="#ef4444" />
          ) : (
            <Ionicons name="mic-outline" size={14} color="rgba(238,241,246,0.55)" />
          )}
        </Pressable>

        {/* Private (Incognito) Mode Toggle */}
        <Pressable
          onPress={() => dispatch({ type: "incognito", category: cat, enabled: !incognito })}
          style={[styles.toolBtn, incognito && { backgroundColor: "rgba(93,189,255,0.15)", borderWidth: 1, borderColor: "rgba(93,189,255,0.3)" }]}
        >
          <Ionicons name={incognito ? "eye-off" : "eye-off-outline"} size={14} color={incognito ? "#5dbdff" : "rgba(238,241,246,0.55)"} />
        </Pressable>

        {/* Web Search Globe Toggle — was orange/gold, which SPEC.md bans
            outright as an accent (not actually on the approved list —
            "orange as second accent" was a mistaken assumption from an
            earlier session). True yellow instead, matching Deep mode.
            General/Coding only — chat.ts's media-generation routes (image/
            video/music) return before ever checking webSearch, so showing
            this on those tabs was a silent no-op. */}
        {(cat === "general" || cat === "coding") && (
          <Pressable
            onPress={() => dispatch({ type: "webSearch", category: cat, enabled: !webSearch })}
            style={[styles.toolBtn, webSearch && { backgroundColor: "rgba(245,224,0,0.15)", borderWidth: 1, borderColor: "rgba(245,224,0,0.3)" }]}
          >
            <Ionicons name={webSearch ? "globe" : "globe-outline"} size={14} color={webSearch ? "#f5e000" : "rgba(238,241,246,0.55)"} />
          </Pressable>
        )}

        {/* Media Generation Options Button */}
        {(cat === "image" || cat === "video" || cat === "music") && (
          <Pressable
            onPress={() => setSettingsVisible(true)}
            style={[
              styles.toolBtn,
              {
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                shadowColor: "#ffffff",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
              }
            ]}
          >
            <Ionicons name="options" size={13} color="#ffffff" />
          </Pressable>
        )}

        {/* Model Mode dropdown chip — matches web 'Default ▾' pill.
            NOTE: react-native-web doesn't reliably "unset" a style property
            with `width: undefined` (the base toolBtn's fixed width can win
            depending on atomic-class insertion order) — must override with
            an explicit value like "auto" instead. */}
        <Pressable
          onPress={nextMode}
          style={[styles.toolBtn, { width: "auto", minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, flexDirection: "row", gap: 3, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }]}
        >
          <Text style={{ color: modeColor, fontSize: 9, fontWeight: "700", fontFamily: fontFamilyForWeight(700) }}>
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
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#0a0c11" />
          ) : (
            <Ionicons name="arrow-up" size={15} color="#0a0c11" />
          )}
        </Pressable>
      </View>

      {/* Media Options Modal */}
      <Modal transparent visible={settingsVisible} animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={localStyles.modalBackdrop} onPress={() => setSettingsVisible(false)}>
          <View style={localStyles.sheet} onStartShouldSetResponder={() => true}>
            <View style={localStyles.sheetHeader}>
              <Text style={localStyles.sheetTitle}>
                {cat.toUpperCase()} GENERATION SETTINGS
              </Text>
              <Pressable onPress={() => setSettingsVisible(false)} style={localStyles.closeBtn}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
              {cat === "image" && (
                <>
                  <Text style={localStyles.label}>ASPECT RATIO</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "1:1", label: "SQUARE 1:1" },
                      { value: "16:9", label: "LANDSCAPE 16:9" },
                      { value: "9:16", label: "PORTRAIT 9:16" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setImageSettings(s => ({ ...s, ar: opt.value }))}
                        style={[localStyles.pill, imageSettings.ar === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, imageSettings.ar === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>QUALITY LEVEL</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "standard", label: "STANDARD" },
                      { value: "hd", label: "HD QUALITY" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setImageSettings(s => ({ ...s, quality: opt.value }))}
                        style={[localStyles.pill, imageSettings.quality === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, imageSettings.quality === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>STYLE PRESET</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "neutral", label: "NEUTRAL" },
                      { value: "photorealistic", label: "REALISTIC" },
                      { value: "3d-render", label: "3D RENDER" },
                      { value: "anime", label: "ANIME" },
                      { value: "cyberpunk", label: "CYBERPUNK" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setImageSettings(s => ({ ...s, style: opt.value }))}
                        style={[localStyles.pill, imageSettings.style === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, imageSettings.style === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>NEGATIVE PROMPT (THINGS TO AVOID)</Text>
                  <TextInput
                    value={imageSettings.negative}
                    onChangeText={(v) => setImageSettings(s => ({ ...s, negative: v }))}
                    placeholder="e.g. blurry, distorted, low quality"
                    placeholderTextColor="rgba(238,241,246,0.3)"
                    style={localStyles.textInput}
                  />
                </>
              )}

              {cat === "video" && (
                <>
                  <Text style={localStyles.label}>ASPECT RATIO</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "16:9", label: "LANDSCAPE 16:9" },
                      { value: "9:16", label: "PORTRAIT 9:16" },
                      { value: "1:1", label: "SQUARE 1:1" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setVideoSettings(s => ({ ...s, ar: opt.value }))}
                        style={[localStyles.pill, videoSettings.ar === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, videoSettings.ar === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>DURATION</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "4", label: "4 SECONDS" },
                      { value: "8", label: "8 SECONDS" },
                      { value: "12", label: "12 SECONDS" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setVideoSettings(s => ({ ...s, duration: opt.value }))}
                        style={[localStyles.pill, videoSettings.duration === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, videoSettings.duration === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>QUALITY LEVEL</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "standard", label: "STANDARD" },
                      { value: "hd", label: "HD 720P" },
                      { value: "full-hd", label: "FULL HD 1080P" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setVideoSettings(s => ({ ...s, quality: opt.value }))}
                        style={[localStyles.pill, videoSettings.quality === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, videoSettings.quality === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>MOTION STRENGTH</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "low", label: "LOW" },
                      { value: "medium", label: "MEDIUM" },
                      { value: "high", label: "HIGH" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setVideoSettings(s => ({ ...s, motion: opt.value }))}
                        style={[localStyles.pill, videoSettings.motion === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, videoSettings.motion === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {cat === "music" && (
                <>
                  <Text style={localStyles.label}>VOCAL MODE</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "vocal", label: "VOCAL TRACK" },
                      { value: "instrumental", label: "INSTRUMENTAL ONLY" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setMusicSettings(s => ({ ...s, vocals: opt.value }))}
                        style={[localStyles.pill, musicSettings.vocals === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, musicSettings.vocals === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>BITRATE / QUALITY</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "standard", label: "STANDARD 128KBPS" },
                      { value: "high", label: "HIGH 320KBPS" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setMusicSettings(s => ({ ...s, quality: opt.value }))}
                        style={[localStyles.pill, musicSettings.quality === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, musicSettings.quality === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>FILE FORMAT</Text>
                  <View style={localStyles.row}>
                    {[
                      { value: "mp3", label: "MP3" },
                      { value: "wav", label: "WAV (LOSSLESS)" }
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setMusicSettings(s => ({ ...s, format: opt.value }))}
                        style={[localStyles.pill, musicSettings.format === opt.value && localStyles.pillActive]}
                      >
                        <Text style={[localStyles.pillText, musicSettings.format === opt.value && localStyles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={localStyles.label}>GENRE / STYLE TAGS</Text>
                  <TextInput
                    value={musicSettings.tags}
                    onChangeText={(v) => setMusicSettings(s => ({ ...s, tags: v }))}
                    placeholder="e.g. synthwave, dark techno, lo-fi beats"
                    placeholderTextColor="rgba(238,241,246,0.3)"
                    style={localStyles.textInput}
                  />
                </>
              )}

              <Pressable onPress={() => setSettingsVisible(false)} style={localStyles.applyBtn}>
                <Text style={localStyles.applyBtnText}>APPLY SETTINGS</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    padding: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
    backgroundColor: "#0d0d12",
    borderTopWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    maxHeight: "75%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  label: {
    color: "rgba(238,241,246,0.55)",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#16161f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  pillActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  pillText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pillTextActive: {
    color: "#000000",
    fontWeight: "900",
  },
  textInput: {
    color: "#fff",
    fontSize: 12.5,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  applyBtn: {
    marginTop: 14,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  applyBtnText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
});
