# Collider — Product Spec (source of truth)

This file is the canonical requirements doc. Do not rely on chat history for
requirement recall — update this file when requirements change, and read
from it, not from conversation memory.

## Core concept
Multi-model AI chat app (native, iOS/Android, Expo). Query multiple models at
once, view responses in a grid of cards. Click a card to open a full detail
("card view") for that model. Purpose: consolidate industry-leading features
from competitor apps (ChatGPT, Claude, Gemini, Grok, etc.) so users never
need to leave the app for a feature another app has. Continuation of
conversations is a differentiator ("my conversations can be continued,
others cannot").

## Categories / tabs
- General, Image, Video, Audio (Music), Coding — each independently scoped:
  own selected models, own conversation/grid state.

## Model selection counts (per category)
- General: 6 free, 3 pro, 3 elite
- Image: 3 pro, 3 elite (no free tier access)
- Video: 3 pro, 3 elite (no free tier access)
- Audio: 3 pro, 3 elite (no free tier access)
- Coding: 3 pro, 3 elite (no free tier access) — agentic, customizable

## Tiers & gating
- Free: 20 messages/day total, regardless of how many models are selected
  per message. No access to media gen (image/video/audio) or coding models.
- Pro / Elite: unlimited use of General (chat-only) tabs.
- Media gen (image/video/audio) requires credits — available to Pro and
  Elite only. Credits have daily, weekly, and monthly limits.
- Coding models (agentic, customizable) are Pro/Elite only.

## Grid view (main view) — PRIORITY: current UI is broken here
- Title bar: keep as-is (user likes it).
- Model selector: keep as popup (user likes it).
- Category selector (General/Image/Video/etc.): must be a **dropdown**, NOT
  a ribbon/row of tabs.
- General UI pattern: prefer dropdowns/drop-ups and folding icon-expansions
  over ribbons/rows wherever applicable.
- Model cards: transparent/glass — background image must show through,
  uninterrupted by cards or other permanent UI chrome.
- **Bug**: model cards do not use the full preview text area for responses;
  some responses render anchored to the bottom of the card instead of
  filling/starting from the top. Must fix so text uses full available area
  correctly.
- Transition from grid view to card (detail) view must be seamless/animated,
  not a hard cut.

## Card (detail) view
- Full standard chat view for a single model.
- Background image (theme) must also render here, in full detail, same as
  grid view — not just on the grid screen.
- All features available in grid view context must carry through here
  (right drawer becomes local/per-card instead of global).

## Theming
- Background image is swappable via a theme switcher (image swap only —
  themes are not different color schemes, just different background images).
- Glass cards remain glass across all themes — transparency/blur treatment
  does not change per theme, only the background image does.

## Drawers
- Left drawer: conversation history.
- Right drawer: "Smart Gen tools" — global scope in grid view, local
  (per-card) scope in card/detail view.

## Smart Gen Suite
Tools: **Projects, Tasks, Reminders (with full calendar), Memories,
Artifacts.**

- Autogeneration: tools can be auto-created from detailed context extraction
  during conversation. Example: working a case with a model (facts, Q&A) →
  Smart Gen auto-creates a Project for it, unless one already exists for
  that case.
- Deadlines: if the user asks about deadlines, the model looks them up,
  presents them, AND auto-creates a Reminder/Task for them.
- Reminders with a date/time automatically get added to a full-featured
  Calendar (Google Calendar-equivalent functionality).
- Documents generated during a conversation (e.g. a timeline, a statement)
  are auto-saved as Artifacts, attached to the relevant Project.
- No duplicate creation within the same category/project/model — Smart Gen
  must check for an existing match before creating a new one.
- Items are freely convertible between types (e.g. Task ↔ Reminder) and
  support custom fields.
- Items can be embedded/attached to one another in any combination:
  Artifacts → Files/Reminders/Tasks/Projects; Reminders → Projects,
  Artifacts, Memories; etc. Fully cross-linked graph, not a rigid hierarchy.

## Search
- Global search with filters by:
  - Type (conversation history, Smart Gen tool type, etc.)
  - Model

## Consensus feature ("Collide")
Full-screen drawer, opened on demand. Layout top to bottom:
1. **Top**: count of selected models that agree, colored on a red→green
   scale based on alignment strength.
2. **Below that**: brief consensus summary text, styled as soft glowing
   blue text.
3. **Below that**: the "dissenting map" — a 2.5D/3D galactic/constellation
   visualization on a black background.
   - Each dissenting model = a sphere ("star") with a one-line dissent
     summary and the model name abbreviated near the sphere.
   - Consensus summary is horizontally centered with space on both sides.
   - Vertical position of each star = that model's agreement level with the
     consensus summary.
   - Horizontal position = net result of that model's collective agreement
     with the *other* dissenting stars (force-directed / physics-like):
     stars in strong mutual disagreement push to opposite horizontal
     extremes; stars with strong affinity cluster together and can pull
     each other (and the cluster) back toward center.

## Media Gen Market
- Full Grok-"Imagine"-market-equivalent: browse/generate image/video/audio
  content, remix, insert-as-source/insert-as-context.
- **Bug**: current market only holds/displays 6 generations at a time —
  needs to support full history, not a fixed cap of 6.
- Credits-gated per the tiers section above.

## Visual/quality bar ("AAA", "smart TV level")
Mandatory, not optional, across the whole app:
- Depth, layered UI, shadows, blur, depth-of-field effects.
- Gradients, textures (e.g. brushed metal), sheen, subtle reflections.
- 3D/2.5D rendering where called for (esp. consensus dissent map).
- No blurry/low-fidelity assets, no non-functional advertised features.
- Benchmark against ChatGPT/Claude/Gemini/Grok conventions unless there's a
  specific reason to deviate.

## Known current weaknesses (as of 2026-07-12 audit request)
- Grid view is the most broken area: category ribbon instead of dropdown,
  cards not filling preview text area correctly (text anchors to bottom in
  some cases).
- Media market caps at 6 generations instead of full history.
- General UI overuses ribbons/rows where dropdowns/fold-outs are wanted.
- Model roster in `src/models.ts` is largely placeholder/invented — not
  real OpenRouter/Groq catalog IDs (see project memory for detail).

## Wallpapers & Music (added 2026-07-13)
- Premium wallpapers are **live wallpapers** (video loops), each sold as an
  **individual purchase** — not unlocked in bulk by Pro/Elite tier alone.
  Price band: **$2.99–$7.99 per wallpaper**.
- Each live wallpaper ships with **at least 5 curated music tracks**
  (curated by the product owner, not user-uploaded/streamed).
- A **music player** in the app lets the user pick which track from the
  currently-owned live wallpapers' bundles plays as ambient **background**
  audio — not a foreground/"now playing" experience the user has to sit on;
  it plays behind whatever screen they're using. The player **only ever
  offers tracks the user purchased** (bundled with a live wallpaper they
  own) — no external streaming, no arbitrary uploads. Each track can be
  toggled on/off from the playlist. A **persistent volume/mute control**
  lives in a fixed corner of the screen, always reachable regardless of
  what screen is open.
- Tracks are stored using whatever the chosen player library's normal
  storage/caching approach is — no custom storage scheme needed.
- Don't build the player from scratch — integrate an existing React
  Native audio/background-playback library (e.g. `react-native-track-player`
  or similar) rather than hand-rolling transport controls, queueing, etc.
- None of the wallpapers currently in the app are premium/live — the
  existing `WALLPAPERS`/`FREE_THEMES` entries are all **static images**.
  `PREMIUM_THEMES` (the video slot) is currently empty/unpopulated; this
  whole feature has no live wallpaper assets yet, paid or otherwise.
- Current implementation status (as of 2026-07-13 audit): **not built**.
  `WallpapersScreen.tsx` only gates premium (video) wallpapers by
  `state.tier !== "free"` — a blanket Pro/Elite perk, not per-wallpaper
  purchase. `iap.ts` has one generic `collider.wallpaper.pack` product, not
  wired to any purchase flow in the Wallpapers screen. No music/track data
  model, no player UI exists yet.
- Product intent behind this (for design judgment on anything touching it):
  the app should feel like a personal, emotionally-present "home," not a
  utility — a place the user would miss if they deleted it. Wallpapers +
  their music are a deliberate emotional/ownership lever toward that, not
  just a monetization add-on.

## Non-goals / clarifications
- Themes = background image swap only. Do not build a secondary
  color-theme system — glass card styling is constant across themes.
- Free tier's 20 msg/day cap applies regardless of number of models
  selected in a single multi-model query (one query to 5 models still only
  counts toward the day's limit as governed by product decision — confirm
  exact counting rule, i.e. per-query vs per-model-response, before
  implementing if ambiguous).
