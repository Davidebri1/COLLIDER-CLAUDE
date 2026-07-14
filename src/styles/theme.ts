import { StyleSheet, Dimensions } from "react-native";

export const SCREEN_W = Dimensions.get("window").width;
export const SCREEN_H = Dimensions.get("window").height;

// Single unified typeface for the whole app. Manrope is loaded as four
// separate static-weight font files (see App.tsx's useFonts call), not one
// variable font — so a style that sets fontWeight:"800" while fontFamily
// points at the Regular file doesn't get real bold, it gets the browser's
// synthetic/faux bold, which reads thinner and blurrier than an actual bold
// face at small sizes. fontFamilyForWeight resolves to the correct loaded
// static file so "bold" is a real font file, not a faux-bold render.
export const FONT_REGULAR = "Manrope_400Regular";
export const FONT_MEDIUM = "Manrope_600SemiBold";
export const FONT_BOLD = "Manrope_700Bold";
export const FONT_EXTRABOLD = "Manrope_800ExtraBold";
export const FONT_FAMILY = FONT_REGULAR;

export function fontFamilyForWeight(weight?: string | number): string {
  const w = weight === "bold" ? 700 : typeof weight === "string" ? parseInt(weight, 10) || 400 : weight || 400;
  if (w >= 800) return FONT_EXTRABOLD;
  if (w >= 700) return FONT_BOLD;
  if (w >= 500) return FONT_MEDIUM;
  return FONT_REGULAR;
}

// Exported so per-screen local StyleSheets (UpgradeScreen, etc.) can opt into
// the same base typeface instead of silently falling back to the platform
// default font — that mismatch is exactly what read as "unprofessional" on
// the Upgrade screen's numbers, which live in a local StyleSheet that never
// got this applied.
export const withFont = (raw: Record<string, any>) =>
  Object.fromEntries(Object.entries(raw).map(([k, v]) => [
    k,
    { ...v, fontFamily: v.fontFamily || fontFamilyForWeight(v.fontWeight) },
  ]));

export const styles = StyleSheet.create(withFont({
  bg: { flex: 1, backgroundColor: "#07040d" },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },

  // ── Title Bar — dedicated brand line ──
  titleBar: {
    paddingTop: 12,
    paddingBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#060608",
  },

  // ── Toolbar — utility controls row ──
  toolbar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#060608",
  },

  // Neutral black/white chrome — no purple/blue tint. Palette rule: black +
  // white as the two base colors, one warm accent (gold/orange, used only
  // where something is genuinely interactive/branded — Collide, active
  // states), everywhere else stays neutral.
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 9,
  },
  iconText: { color: "#f9f5ff", fontSize: 20, fontWeight: "600" },

  // Wordmark — premium brand identity
  wordmarkWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  wordmarkAccent: {
    width: 24,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 1,
  },
  wordmarkText: {
    color: "#f0ecf8",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 13,
    textShadowColor: "rgba(220,210,255,0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  pill: {
    height: 34, borderRadius: 17, borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#161619",
    shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 5,
  },
  pillText: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  muted: { color: "#6b6478", fontSize: 12 },
  mutedCenter: { color: "#6b6478", fontSize: 12, textAlign: "center" },

  tabRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 8 },
  tab: {
    paddingHorizontal: 14, height: 32, borderRadius: 16,
    justifyContent: "center",
    backgroundColor: "#161619",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "rgba(255,255,255,0.3)", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  tabText: { color: "#6b6478", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  tabTextActive: { color: "#fff" },
  textStrong: { color: "#fff", fontWeight: "700" },

  // Tray chips — small, pill, with dot + shadow when selected
  tray: { paddingHorizontal: 14, gap: 6, paddingBottom: 6, alignItems: "center" },
  trayDivider: {
    width: 1, height: 18, marginHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  chip: {
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: "#9a949f", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  chipLock: { color: "#6b6478", fontSize: 9, marginLeft: 2 },

  // Row selector
  rowSelector: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingBottom: 6, justifyContent: "flex-end",
  },
  rowLabel: { color: "#6b6478", fontSize: 9, fontWeight: "800", letterSpacing: 2, marginRight: 4 },
  rowBtn: {
    width: 26, height: 26, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#161619",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  rowBtnActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "rgba(255,255,255,0.25)", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  rowBtnText: { color: "#6b6478", fontSize: 11, fontWeight: "800" },
  rowBtnTextActive: { color: "#fff" },

  emptyWrap: { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  empty: { minHeight: 160, borderRadius: 24, alignItems: "center", justifyContent: "center", padding: 24 },

  glass: {
    overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(18,18,20,0.45)",
  },
  modelCard: { flex: 1, borderRadius: 18, padding: 7 },
  glow: { position: "absolute", width: 120, height: 120, borderRadius: 60, left: -42, bottom: -42, opacity: 0.2 },
  cardTop: { flexDirection: "row", gap: 8 },
  cardTitle: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", textShadowColor: "#000000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  // Subheader, not a second headline — this used to be bold/white/shadowed,
  // competing with the title right above it instead of sitting quietly under it.
  cardDesc: { color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 9, letterSpacing: 0.1 },
  smallRound: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cardBody: { marginTop: 4 },
  // Heavier shadow than a typical UI text style — this is what keeps a
  // response legible directly over a busy wallpaper/glass card with no
  // bubble fill behind it, instead of relying on a background box for
  // contrast.
  bodyText: { color: "#ffffff", fontSize: 13, lineHeight: 19, textShadowColor: "rgba(0,0,0,0.85)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5 },
  placeholder: { color: "#ffffff", fontStyle: "italic", fontSize: 13, textShadowColor: "#000000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  composer: {
    marginHorizontal: 14, marginBottom: 8, borderRadius: 22, padding: 10,
    backgroundColor: "rgba(18,18,20,0.72)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  input: { color: "#fff", minHeight: 38, maxHeight: 110, fontSize: 15 },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 6 },
  toolBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#161619", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  toolIcon: { color: "#6b6478", fontSize: 16 },
  // The app's namesake feature — gradient-filled and glowing, not just
  // another muted icon in the utility row next to mic/attach/globe.
  collideBtn: {
    height: 34, borderRadius: 17, overflow: "hidden",
    shadowColor: "#ffb74d", shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  collideBtnGradient: {
    height: "100%", paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
  },
  send: {
    marginLeft: "auto",
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "rgba(255,255,255,0.2)", shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  disabled: { opacity: 0.38 },
  sendText: { color: "#0c0c0e", fontWeight: "900", fontSize: 14 },

  // Collide track button styles
  collideTrackBtn: {
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff8a65",
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  collideBtnText: {
    color: "#0c0c0e",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },

  // Lock and Fog container styles
  lockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  lockText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  fogContainer: {
    borderRadius: 22,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  // Consensus screen styling
  verdictWrap: {
    marginTop: 10,
    marginBottom: 12,
    width: "100%",
  },
  verdictLabel: {
    color: "#6b6478",
    textTransform: "uppercase",
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: "center",
  },
  summaryContainer: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(20,12,32,0.65)",
    borderWidth: 0, // centered box with invisible borders
    shadowColor: "#3b82f6", // soft glowing blue text with deep shadows
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    alignItems: "center",
  },
  summaryCenterText: {
    color: "#93c5fd",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    textShadowColor: "rgba(59, 130, 246, 0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  dissentList: {
    flex: 1,
    width: "100%",
    marginTop: 10,
  },
  dissentCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 6,
  },
  dissentText: {
    color: "#9a949f",
    fontSize: 11,
    marginTop: 4,
  },

  // Imagine Market preview player styles
  previewImageContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 14,
  },
  previewImage: {
    flex: 1,
  },
  previewDetails: {
    width: "100%",
    marginBottom: 14,
  },
  previewPromptBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  previewActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  previewActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  previewActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.56)", zIndex: 50 },
  drawer: { position: "absolute", left: 0, top: 0, bottom: 0, width: 306, paddingTop: 54, paddingHorizontal: 14 },
  planBox: { borderRadius: 20, padding: 14, marginVertical: 16 },
  bigText: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  drawerItem: {
    borderRadius: 16, paddingVertical: 13, paddingHorizontal: 12,
    marginBottom: 4, backgroundColor: "rgba(255,255,255,0.04)",
  },

  fullModal: { flex: 1, paddingTop: 54, paddingHorizontal: 18 },
  kicker: { color: "#6b6478", textTransform: "uppercase", fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  score: { color: "#ffc04d", fontSize: 84, fontWeight: "900", textAlign: "center" },
  svg: { alignSelf: "center", marginVertical: 14 },
  verdict: { borderRadius: 20, padding: 16 },
  pageTitle: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 1 },
  page: { padding: 14, gap: 12, paddingBottom: 120 },
  messageList: { padding: 14, gap: 10 },
  bubble: {
    maxWidth: "86%", padding: 12, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
  },
  // "False bubble" — the response side keeps a real (if faint) glass panel
  // for legibility, but the user's own messages don't need a competing box:
  // they're already visually distinct by alignment/role, and a loud tinted
  // bubble on both sides was pulling attention away from the responses,
  // which are the part actually worth reading.
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 0,
  },
  listItem: { borderRadius: 20, padding: 14, gap: 8 },
  rowItem: { borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  done: { color: "#6b6478", textDecorationLine: "line-through" },
  inlineAdd: { minHeight: 52, borderRadius: 20, padding: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  compact: { marginTop: 8, minHeight: 42, borderRadius: 14 },
  inlineInput: { flex: 1, color: "#fff", fontSize: 14, paddingHorizontal: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#a78bfa", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  primaryBtn: {
    borderRadius: 16, padding: 12, alignItems: "center", marginTop: 8,
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.5)",
    shadowColor: "#a78bfa", shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 5,
  },
  primaryText: { color: "#a78bfa", fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  segment: { flexDirection: "row", gap: 8, marginBottom: 10 },
  segmentBtn: { borderRadius: 15, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,0.05)" },
  segmentActive: {
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.35)",
  },
  miniBtn: { marginTop: 8, alignSelf: "flex-start", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#a78bfa" },
  fileTile: { width: "47%", aspectRatio: 1, borderRadius: 20, alignItems: "center", justifyContent: "center", padding: 12 },
  fileIcon: { color: "#fff", fontSize: 34, marginBottom: 8 },
  marketTile: { width: "100%", height: "100%", aspectRatio: 0.72, borderRadius: 20, justifyContent: "space-between" },
  sparkle: { fontSize: 42, textAlign: "center", marginTop: 46 },
  tileFooter: { marginTop: "auto", padding: 10, backgroundColor: "rgba(0,0,0,0.32)" },
  wallTile: { width: "100%", aspectRatio: 0.72, borderRadius: 20, padding: 12, justifyContent: "flex-end" },
  tileName: { color: "#fff", fontWeight: "800", fontSize: 14 },
  price: { color: "#fff7d7", fontSize: 11, marginTop: 6 },

  // Smart Gen Toast
  toastContainer: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: "center",
  },
  toastBlur: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
    shadowColor: "#a78bfa",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: {
    color: "#fff7d7",
    fontSize: 12,
    fontWeight: "700",
  },

  // Media bubble layout
  chatMediaContainer: {
    width: "100%",
    aspectRatio: 1.25,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chatMediaImage: {
    flex: 1,
  },
  chatMediaControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "rgba(7,4,13,0.85)",
  },
  audioPlayerCard: {
    borderRadius: 18,
    padding: 12,
    marginTop: 6,
    width: "100%",
    borderColor: "rgba(255,255,255,0.1)",
  },
  videoPlayerCard: {
    borderRadius: 18,
    padding: 12,
    marginTop: 6,
    width: "100%",
    borderColor: "rgba(255,255,255,0.1)",
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 8,
    borderRadius: 12,
  },
  vinylDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#333",
  },
  vinylCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#a78bfa",
  },
  playPauseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#a78bfa",
    alignItems: "center",
    justifyContent: "center",
  },
  videoSimContainer: {
    width: "100%",
    aspectRatio: 1.77,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    marginVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  videoSimPlayBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(7,4,13,0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  // Passed as the style prop to <Glass isCard> for the crisp-border/corner-
  // sheen accent treatment — but Glass's isCard variant has NO blur backing
  // (by design, for small thumbnail-style cards), so this needs its own
  // near-opaque background or a modal sheet turns into a see-through pane
  // with the chat/wallpaper bleeding straight through behind it.
  editSheet: {
    width: 300,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "rgba(13,10,20,0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignSelf: "center",
    marginTop: 100,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  editInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    padding: 10,
    borderRadius: 10,
    fontSize: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  prioBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
  },
  traySpecialBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#161619",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 8,
  },


  // Circular chip selector (model tray)
  chipCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCircleText: {
    color: "#c5bdd4",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  chipCircleLock: {
    position: "absolute",
    bottom: -2,
    right: -2,
    fontSize: 9,
  },

  // Sub tab tray (inside card screen)
  subTabTray: {
    backgroundColor: "#060608",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  subTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1a1130",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  subTabText: {
    color: "#6b6478",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  // Modal backdrop and edit sheet header
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  // No default color — each modal supplies its own accent inline so a
  // Reminder's sheet doesn't look identical to a Memory's or an Artifact's.
  sheetKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  // Horizontal single-row model tray
  modelTrayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  tierSep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 2,
  },
  tierSepLine: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  tierSepLabel: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
}));




export interface DynamicTheme {
  id: string;
  name: string;
  source: any;
  premium?: boolean;
}

export let FREE_THEMES: DynamicTheme[] = [];
try {
  const context = (require as any).context("../../assets/themes/free", false, /\.(png|jpe?g)$/);
  FREE_THEMES = context.keys().map((key: string) => ({
    id: `free_${key.replace(/^\.\//, "")}`,
    name: key.replace(/^\.\//, "").replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
    source: context(key),
    premium: false,
  }));
} catch (e) {
  // Empty directory or context unsupported
}

export let PREMIUM_THEMES: DynamicTheme[] = [];
try {
  const context = (require as any).context("../../assets/themes/premium", false, /\.(mp4|m4v|mov)$/);
  PREMIUM_THEMES = context.keys().map((key: string) => ({
    id: `premium_${key.replace(/^\.\//, "")}`,
    name: key.replace(/^\.\//, "").replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
    source: context(key),
    premium: true,
  }));
} catch (e) {
  // Empty directory or context unsupported
}

const bg = require("../../assets/bg-default.jpg");


import { WallpaperId } from "../state";

export const WALLPAPERS: {
  id: WallpaperId;
  name: string;
  colors: [string, string, ...string[]];
  premium?: boolean;
}[] = [
  { id: "default",  name: "Collider",       colors: ["rgba(7,4,13,0.35)", "rgba(7,4,13,0.82)", "rgba(7,4,13,0.94)"] },
  { id: "aurora",   name: "Aurora",         colors: ["#163b82", "#22b884", "#07040d"] },
  { id: "cove",     name: "Midnight Cove",  colors: ["#091a4a", "#60315f", "#07040d"] },
  { id: "inferno",  name: "Inferno",        colors: ["#f46b32", "#31135e", "#07040d"], premium: true },
  { id: "quartz",   name: "Quartz",         colors: ["#65d5cf", "#ab54d8", "#07040d"], premium: true },
  { id: "magnolia", name: "Magnolia",       colors: ["#e8ae98", "#c4488c", "#07040d"] },
  { id: "voyager",  name: "Voyager",        colors: ["#a78bfa", "#16184f", "#07040d"], premium: true },
];
