// Additional screens and UI components layered on top of App.tsx.
// Kept separate to avoid touching the main App shell.
import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View,
  type StyleProp, type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useCollider, FREE_DAILY_LIMIT, type ChatMessage, type ConsensusRun } from "./state";
import { modelById, MODELS, type Category } from "./models";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Page } from "./components/Page";
import { withFont } from "./styles/theme";

// ── Search bar ─────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={styles.searchWrap}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8f849c"
        style={styles.searchInput}
      />
      {value ? (
        <Pressable onPress={() => onChange("")}><Text style={styles.searchIcon}>×</Text></Pressable>
      ) : null}
    </View>
  );
}

export function useSearch<T>(items: T[], getText: (item: T) => string) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => getText(it).toLowerCase().includes(needle));
  }, [items, q, getText]);
  return { q, setQ, filtered };
}

export function MessageActions({
  visible, message, category, modelId, onClose, onRetry, onEdit,
}: {
  visible: boolean;
  message: ChatMessage | null;
  category: Category;
  modelId: string;
  onClose: () => void;
  onRetry?: (m: ChatMessage) => void;
  onEdit?: (m: ChatMessage) => void;
}) {
  const { dispatch } = useCollider();
  if (!message) return null;
  let actions: { label: string; icon: string; onPress: () => void }[] = [];

  const copyAction = { label: "Copy", icon: "⧉", onPress: async () => { const { copyText } = await import("./services/media"); await copyText(message.content); onClose(); } };
  const selectAllAction = { label: "Select All", icon: "⚄", onPress: async () => { const { copyText } = await import("./services/media"); await copyText(message.content); onClose(); } };
  const shareAction = { label: "Share", icon: "↗", onPress: () => { Share.share({ message: message.content }).catch(() => {}); onClose(); } };
  const saveFilesAction = { label: "Save", icon: "▣", onPress: () => { dispatch({ type: "file", file: { name: `message-${message.id.slice(0,6)}.txt`, kind: "generated", url: `text://${encodeURIComponent(message.content).slice(0,120)}` } }); onClose(); } };
  const saveNotesAction = { label: "Notes", icon: "▤", onPress: () => { dispatch({ type: "memory", memory: { id: `m_${Math.random().toString(36).slice(2, 9)}`, ts: Date.now(), title: "Saved Note", content: message.content, projectId: "" } }); onClose(); } };
  const deleteAction = { label: "Delete", icon: "✕", onPress: () => { dispatch({ type: "deleteMessage", category, modelId, messageId: message.id }); onClose(); } };

  if (message.role === "user") {
    actions = [copyAction];
    if (onEdit) actions.push({ label: "Edit", icon: "✎", onPress: () => { onEdit(message); onClose(); } });
    if (onRetry) actions.push({ label: "Retry", icon: "↻", onPress: () => { onRetry(message); onClose(); } });
    actions.push(selectAllAction, saveFilesAction, saveNotesAction, shareAction, deleteAction);
  } else {
    actions = [copyAction];
    if (onRetry) actions.push({ label: "Retry", icon: "↻", onPress: () => { onRetry(message); onClose(); } });
    actions.push(shareAction, selectAllAction, saveFilesAction, saveNotesAction, deleteAction);
  }
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.sheetKicker}>Message · {message.role}</Text>
          <Text style={styles.sheetPreview} numberOfLines={3}>{message.content || "(empty)"}</Text>
          <View style={styles.sheetGrid}>
            {actions.map((a) => (
              <Pressable key={a.label} onPress={a.onPress} style={styles.sheetBtn}>
                <Text style={styles.sheetIcon}>{a.icon}</Text>
                <Text style={styles.sheetLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Settings screen ────────────────────────────────────────────────────────
export function SettingsScreen({ goBack, openAuth, openWallpapers }: { goBack: () => void; openAuth: () => void; openWallpapers: () => void }) {
  const { state, dispatch } = useCollider();

  // Fixed silver/chrome selected-state — not a user-customizable hue. A
  // rainbow swatch picker here was letting the whole app's "active" tint be
  // set to any arbitrary saturated color, which is exactly the kind of
  // ad-hoc per-screen color decision the app's palette rules exist to
  // prevent. "Sleek black, sleek white gloss" means the neutral/metallic
  // tones do this job, not another hue to defend or swap out later.
  const activeTint = "rgba(226,232,240,0.16)";
  const activeBorder = "rgba(226,232,240,0.55)";
  const activeText = "#e2e8f0";

  const DENSITIES: Array<{ value: "compact" | "comfortable" | "spacious"; label: string }> = [
    { value: "compact", label: "Compact" },
    { value: "comfortable", label: "Comfortable" },
    { value: "spacious", label: "Spacious" },
  ];
  const FONT_SIZES: Array<{ value: "small" | "medium" | "large"; label: string }> = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ];
  const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese", "Portuguese", "Chinese"];
  const CHAT_MODES: Array<{ value: import("./state").ChatMode; label: string }> = [
    { value: "default", label: "Default" },
    { value: "research", label: "Research" },
    { value: "deep", label: "Deep Research" },
  ];

  const handleExport = async () => {
    const data = JSON.stringify({
      conversations: state.conversations,
      memories: state.memories,
      reminders: state.reminders,
      projects: state.projects,
    }, null, 2);
    Share.share({ message: data, title: "Collider Data Export" }).catch(() => {});
  };

  return (
    <Page title="Settings" goBack={goBack}>
        {/* ── Account ── */}
        <SettingsSection title="Account">
          <SettingsRow
            label={state.auth.kind === "guest" ? "Guest Mode" : `Signed in · ${(state.auth as any).email || state.auth.kind}`}
            hint={state.auth.kind === "guest" ? "Sign in to sync across devices" : "Tap to manage account"}
            onPress={openAuth}
          />
          <SettingsRow
            label={`Subscription — ${state.tier.toUpperCase()}`}
            hint={
              state.tier === "free"
                ? `${state.dailyMessagesSent}/${FREE_DAILY_LIMIT} general chat messages today · media/coding models locked`
                : `Unlimited general chat · ${state.credits.toLocaleString()} daily credits left for image/video/audio/coding models`
            }
          />
          <Pressable
            onPress={() => dispatch({ type: "resetLimits" })}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 13,
              paddingHorizontal: 16,
              opacity: pressed ? 0.6 : 1,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.06)",
            })}
          >
            <View>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Reset Usage Limits</Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
                Zero daily & monthly counters · refill credits to tier pool
              </Text>
            </View>
            <Text style={{ color: "#e2e8f0", fontSize: 13, fontWeight: "700" }}>RESET</Text>
          </Pressable>
        </SettingsSection>

        {/* ── Chat Behavior ── */}
        <SettingsSection title="Chat Behavior">
          <SettingsToggleRow
            label="Auto-scroll to latest message"
            hint="Automatically scroll to newest message on response"
            value={state.autoScroll}
            onValueChange={(v) => dispatch({ type: "setAutoScroll", value: v })}
          />
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Default chat mode</Text>
              <Text style={styles.settingsHint}>Applied to new conversations</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {CHAT_MODES.map((m) => (
                <Pressable
                  key={m.value}
                  onPress={() => dispatch({ type: "setGlobalDefaultChatMode", value: m.value })}
                  style={[styles.segChip, state.globalDefaultChatMode === m.value && { backgroundColor: activeTint, borderColor: activeBorder }]}
                >
                  <Text style={[styles.segChipText, state.globalDefaultChatMode === m.value && { color: activeText, fontWeight: "800" as const }]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </SettingsSection>

        {/* ── Display ── */}
        <SettingsSection title="Display">
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Message density</Text>
              <Text style={styles.settingsHint}>Controls spacing between messages</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {DENSITIES.map((d) => (
                <Pressable
                  key={d.value}
                  onPress={() => dispatch({ type: "setMessageDensity", value: d.value })}
                  style={[styles.segChip, state.messageDensity === d.value && { backgroundColor: activeTint, borderColor: activeBorder }]}
                >
                  <Text style={[styles.segChipText, state.messageDensity === d.value && { color: activeText, fontWeight: "800" as const }]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Font size</Text>
              <Text style={styles.settingsHint}>Applies to chat messages</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {FONT_SIZES.map((f) => (
                <Pressable
                  key={f.value}
                  onPress={() => dispatch({ type: "setFontSize", value: f.value })}
                  style={[styles.segChip, state.fontSize === f.value && { backgroundColor: activeTint, borderColor: activeBorder }]}
                >
                  <Text style={[styles.segChipText, state.fontSize === f.value && { color: activeText, fontWeight: "800" as const }]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <SettingsToggleRow
            label="Show model descriptions"
            hint="One-line description beneath model name on cards"
            value={state.showModelDescriptions}
            onValueChange={(v) => dispatch({ type: "setShowModelDescriptions", value: v })}
          />
        </SettingsSection>

        {/* ── Appearance ── */}
        <SettingsSection title="Appearance">
          <SettingsRow label="Wallpaper & themes" hint="Free and premium backgrounds" onPress={openWallpapers} />
        </SettingsSection>

        {/* ── Language ── */}
        <SettingsSection title="Language">
          <View style={styles.settingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsLabel}>Interface language</Text>
              <Text style={styles.settingsHint}>{state.language}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 200 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang}
                    onPress={() => dispatch({ type: "setLanguage", value: lang })}
                    style={[styles.segChip, state.language === lang && { backgroundColor: activeTint, borderColor: activeBorder }]}
                  >
                    <Text style={[styles.segChipText, state.language === lang && { color: activeText, fontWeight: "800" as const }]}>{lang}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </SettingsSection>

        {/* ── Notifications ── */}
        <SettingsSection title="Notifications">
          <SettingsToggleRow
            label="Smart Gen alerts"
            hint="Notify when memories or reminders are auto-generated"
            value={state.smartGenNotifications}
            onValueChange={(v) => dispatch({ type: "setSmartGenNotifications", value: v })}
          />
        </SettingsSection>

        {/* ── Smart Gen ── */}
        <SettingsSection title="Smart Gen Suite">
          <SettingsToggleRow
            label="Auto-generate memories & reminders"
            hint="Extract from your prompts (private mode disables per tab)"
            value={state.autoGen}
            onValueChange={(v) => dispatch({ type: "autoGen", enabled: v })}
          />
        </SettingsSection>

        {/* ── Privacy ── */}
        <SettingsSection title="Privacy — Private Mode per Tab">
          {(["general","image","video","music","coding"] as Category[]).map((cat) => (
            <SettingsToggleRow
              key={cat}
              label={`${cat.charAt(0).toUpperCase() + cat.slice(1)} tab`}
              hint="No auto-capture, no history persisted in this tab"
              value={!!state.incognito[cat]}
              onValueChange={(v) => dispatch({ type: "incognito", category: cat, enabled: v })}
            />
          ))}
        </SettingsSection>

        {/* ── Data ── */}
        <SettingsSection title="Data & Privacy">
          <SettingsRow label="Export my data" hint="Download conversations, memories, and projects as JSON" onPress={handleExport} />
          <SettingsRow label="Delete all memories" hint="Irreversible — removes all saved memories" onPress={() => { /* Implement with confirmation */ }} />
        </SettingsSection>

        {/* ── About ── */}
        <SettingsSection title="About">
          <SettingsRow label="Collider" hint="v1.0.0 — native iOS & Android" />
          <SettingsRow label="Send feedback" hint="hello@collider.app" onPress={() => Share.share({ message: "Collider feedback: " })} />
          <SettingsRow
            label="Terms & Privacy Policy"
            hint="View terms of service"
            onPress={async () => {
              const WebBrowser = await import("expo-web-browser");
              // TODO: point at the real, live legal pages before submitting to
              // either store — both App Store Connect and Play Console require
              // a reachable Privacy Policy URL, and this was previously a dead
              // onPress that did nothing at all.
              await WebBrowser.openBrowserAsync("https://collider.app/legal").catch(() => {});
            }}
          />
        </SettingsSection>
    </Page>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionKicker}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}
function SettingsRow({ label, hint, onPress }: { label: string; hint?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.settingsRow} disabled={!onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel}>{label}</Text>
        {hint ? <Text style={styles.settingsHint}>{hint}</Text> : null}
      </View>
      {onPress ? <Text style={styles.settingsChev}>›</Text> : null}
    </Pressable>
  );
}
function SettingsToggleRow({ label, hint, value, onValueChange }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.settingsRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsLabel}>{label}</Text>
        {hint ? <Text style={styles.settingsHint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: "#e2e8f0", false: "#3b334a" }} thumbColor="#fff" />
    </View>
  );
}

// Real format check (not just "contains @") plus a blocklist of the
// disposable-email domains people actually use to farm fresh free-tier
// accounts once their daily/monthly limit is hit. Doesn't require a backend
// — this is the cheap, immediate deterrent; real abuse-prevention (limits
// tracked server-side per verified account) is a separate, bigger project.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "temp-mail.org", "guerrillamail.com",
  "10minutemail.com", "yopmail.com", "throwawaymail.com", "getnada.com",
  "trashmail.com", "fakeinbox.com", "sharklasers.com", "maildrop.cc",
]);
function validateEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  const domain = email.split("@")[1];
  if (domain && DISPOSABLE_DOMAINS.has(domain)) return "Disposable email addresses aren't accepted.";
  return null;
}

export function AuthScreen({ goBack }: { goBack: () => void }) {
  const { state, dispatch } = useCollider();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  return (
    <Page title="Sign in" goBack={goBack}>
        <Text style={styles.authIntro}>
          Collider works fully as a guest. Sign in only if you want to sync your history, memories, and files across devices.
        </Text>
        <View style={styles.authCard}>
          <Text style={styles.settingsLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(null); }}
            placeholder="you@collider.app"
            placeholderTextColor="#8f849c"
            style={[styles.authInput, emailError && { borderColor: "rgba(239,68,68,0.5)" }]}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {emailError && <Text style={styles.authError}>{emailError}</Text>}
          <Pressable
            onPress={() => {
              const err = validateEmail(email);
              if (err) { setEmailError(err); return; }
              dispatch({ type: "auth", user: { kind: "email", email: email.trim().toLowerCase() } });
              goBack();
            }}
            style={styles.authPrimary}
          >
            <Text style={styles.authPrimaryText}>Continue with email</Text>
          </Pressable>
          <View style={styles.divider}><Text style={styles.dividerText}>or</Text></View>
          <Pressable style={styles.authProvider} onPress={() => { dispatch({ type: "auth", user: { kind: "google", email: "google-user@collider.app" } }); goBack(); }}>
            <Text style={styles.authProviderText}>Continue with Google</Text>
          </Pressable>
          <Pressable style={styles.authProvider} onPress={() => { dispatch({ type: "auth", user: { kind: "apple", email: "apple-user@collider.app" } }); goBack(); }}>
            <Text style={styles.authProviderText}>Continue with Apple</Text>
          </Pressable>
          <Pressable style={styles.authGuest} onPress={() => { dispatch({ type: "auth", user: { kind: "guest" } }); goBack(); }}>
            <Text style={styles.authGuestText}>Continue as guest</Text>
          </Pressable>
        </View>
        <Text style={styles.authFine}>
          Google & Apple providers require an EAS build with the respective plugins configured. Guest mode is fully functional out of the box.
        </Text>
    </Page>
  );
}

// ── Consensus history viewer ───────────────────────────────────────────────
export function ConsensusRunCard({ run, onOpen, onDelete }: { run: ConsensusRun; onOpen: () => void; onDelete: () => void }) {
  const pct = Math.round((run.ratioN / Math.max(run.ratioM, 1)) * 100);
  const color = pct >= 66 ? "#4be6b1" : pct >= 40 ? "#e2e8f0" : "#ff6b6b";
  return (
    <Pressable onPress={onOpen}>
      <View style={styles.consensusItem}>
        <View style={styles.consensusRow}>
          <Text style={[styles.consensusScore, { color }]}>{run.ratioN}/{run.ratioM}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsLabel} numberOfLines={1}>{run.prompt || "Untitled consensus"}</Text>
            <Text style={styles.settingsHint}>{new Date(run.ts).toLocaleString()} · {run.category}</Text>
          </View>
          <Pressable onPress={onDelete} hitSlop={10}><Text style={styles.settingsChev}>✕</Text></Pressable>
        </View>
        <Text style={styles.consensusVerdict} numberOfLines={2}>{run.verdict}</Text>
        {run.dissenters.length > 0 ? (
          <Text style={styles.settingsHint}>Dissenters: {run.dissenters.map((d) => modelById(d.modelId)?.short || d.modelId).join(", ")}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create(withFont({
  flex: { flex: 1 },
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#1e172e", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  iconText: { color: "#f9f5ff", fontSize: 20, fontWeight: "600" },
  pageTitle: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  page: { padding: 14, gap: 14, paddingBottom: 120 },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#1e172e", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", height: 40 },
  searchIcon: { color: "#a79bb5", fontSize: 15 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12, backgroundColor: "#161026", borderTopWidth: 1.5, borderColor: "rgba(255,255,255,0.15)" },
  sheetKicker: { color: "#a79bb5", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  sheetPreview: { color: "#f4edf9", fontSize: 13, lineHeight: 18 },
  sheetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  sheetBtn: { width: "22%", aspectRatio: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#241b38", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", gap: 4 },
  sheetIcon: { color: "#e2e8f0", fontSize: 20 },
  sheetLabel: { color: "#f4edf9", fontSize: 11, fontWeight: "600" },

  section: { gap: 8 },
  sectionKicker: { color: "#6b6478", fontSize: 9.5, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", paddingHorizontal: 4 },
  sectionBody: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden", backgroundColor: "rgba(255,255,255,0.02)" },
  settingsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  settingsLabel: { color: "#fff", fontSize: 14, fontWeight: "600" },
  settingsHint: { color: "#858091", fontSize: 11, marginTop: 2 },
  settingsChev: { color: "#6b6478", fontSize: 20 },

  accentRow: { flexDirection: "row", gap: 10, padding: 16, flexWrap: "wrap" },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "transparent" },
  // Selection ring only — a flat border, not a blurred shadow halo. This is
  // the one "which hue is picked" indicator that intentionally does NOT
  // derive from the picked hue itself (a ring drawn in the same color as
  // the swatch it's ringing would be invisible), so it stays a neutral
  // cream instead of tinting to whatever's selected.
  swatchActive: { borderColor: "#fff7d7" },

  authIntro: { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },
  authCard: { padding: 18, borderRadius: 20, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" },
  authInput: { color: "#fff", fontSize: 14, backgroundColor: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  authError: { color: "#ef4444", fontSize: 11.5, fontWeight: "600", marginTop: -4 },
  authPrimary: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#e2e8f0",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  authPrimaryText: { color: "#e2e8f0", fontWeight: "800" },
  divider: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 4 },
  dividerText: { color: "#8d8398", fontSize: 11, letterSpacing: 2 },
  authProvider: { padding: 13, borderRadius: 14, alignItems: "center", backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  authProviderText: { color: "#fff", fontWeight: "600" },
  authGuest: { padding: 13, alignItems: "center" },
  authGuestText: { color: "#858091", fontSize: 13, textDecorationLine: "underline" },
  authFine: { color: "#6b6478", fontSize: 11, textAlign: "center", paddingHorizontal: 12 },

  consensusItem: { padding: 14, borderRadius: 18, gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" },
  consensusRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  consensusScore: { fontSize: 22, fontWeight: "900", minWidth: 60 },
  consensusVerdict: { color: "#fff", fontSize: 13, lineHeight: 18 },

  // Segment chip for settings selectors
  segChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  segChipText: {
    color: "#a79bb5",
    fontSize: 11,
    fontWeight: "600",
  },
}));
