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

## Model selection counts (per category) — current as of this rewrite
- General: 8 free, 4 pro, 4 elite
- Image: 2 pro, 2 elite (no free tier access)
- Video: 3 pro, 3 elite (no free tier access)
- Audio: 3 pro, 3 elite (no free tier access)
- Coding: 2 free, 4 pro, 3 elite (no free tier access to *use*, but a couple
  of free coder models exist in the roster for when a user does have coding
  access)
- Roster is real, curated OpenRouter/Groq catalog IDs (verified against a
  live catalog fetch, not invented) — see `src/models.ts` for the exact list
  and `src/services/chat.ts`'s `ROUTES` for the provider mapping. No Opus, no
  Fable anywhere (the app offers unlimited messages, so per-request cost has
  to stay sane at every tier).

## Tiers & gating
- Free: 20 messages/day total, regardless of how many models are selected
  per message. No access to media gen (image/video/audio) or coding models.
- Pro / Elite: unlimited use of General (chat-only) tabs.
- Media gen (image/video/audio) requires credits — available to Pro and
  Elite only. Credits have daily, weekly, and monthly limits.
- Coding models (agentic, customizable) are Pro/Elite only.

## Grid view (main view)
- Title bar: as-is.
- Model selector: popup (`Select Models (CATEGORY)` modal).
- Category selector: a dropdown trigger (`CategoryDropdownTrigger` +
  `CategorySelectorModal`), not a ribbon/row of tabs. **Resolved.**
- Model cards: transparent/glass — background image shows through.
- Card text fills from the top; new replies scroll to the *top* of the
  latest message, not the bottom of it (applies to both the grid mini-cards
  and the full card-detail view — same `onLayout` + `scrollTo(y)` pattern in
  both). **Resolved** — was previously anchoring to bottom / scrolling to end.

## Card (detail) view
- Full standard chat view for a single model.
- Background image (theme) renders here too, same as grid view.
- Right drawer (Smart Gen tools) is local/per-card scope here vs. global in
  grid view.

## Theming & color system
- Background image is swappable via a theme switcher (image swap only —
  themes are not different color schemes, just different background images).
  Glass cards remain glass across all themes.
- **No user-customizable accent hue.** (A rainbow swatch picker in Settings
  → Appearance was removed — it let the whole app's "active/selected" tint
  be set to any arbitrary saturated color, which fights the rule below.)
- **Palette rule**: black + white do the heavy lifting everywhere (matte and
  glossy both used deliberately — glossy black/glossy ivory + metallic
  silver/chrome reads premium; matte reads rugged/rustic, don't mix the two
  finishes on the same element). Accent color only where something is
  genuinely interactive/selected, and **bold only** — no pastel/faded/washed-
  out version of any color, ever. A muted/desaturated look is reserved for
  genuinely disabled/locked states, not decoration.
- **No gold, no purple** as the app's accent — both explicitly rejected.
  Current fixed "selected/active" accent is silver/chrome (`#e2e8f0`).
  Acceptable bold-accent family if a *second* deliberate accent is ever
  needed: true yellow, deep violet (not lavender/pastel), crimson/vermillion
  red, metallic silver/chrome.
- Model identity colors (each model's own accent in `src/models.ts`) and
  category icon colors are exempt from the above — those are intentionally
  varied to distinguish many models/categories at a glance, same logic as
  photos/images being exempt.
- Font: Manrope, loaded as 4 separate static-weight files (400/600/700/800),
  not one variable font. Always resolve `fontFamily` via
  `fontFamilyForWeight(weight)` (theme.ts) alongside any `fontWeight` — using
  the Regular file with a bold `fontWeight` produces browser-synthesized
  faux-bold (thin/blurry), not a real bold face.

## Drawers
- Left drawer: Settings/Account/Usage (utility icons at top) + History as a
  sortable table (tap header to sort, tap again to flip direction — same
  pattern as Reminders), with Consensus as a tab lip alongside Conversations.
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
- Reminders with a date/time get a scheduled push notification
  (`services/media.ts`'s `scheduleReminder`) at the exact due time.
  **Not implemented**: any alert-offset options (e.g. "5 min before"),
  per-reminder notification toggle, or repeat/recurring alerts — it's a
  single fixed-time notification with no configurability yet.
- Documents generated during a conversation (e.g. a timeline, a statement)
  are auto-saved as Artifacts, attached to the relevant Project.
- No duplicate creation within the same category/project/model — Smart Gen
  must check for an existing match before creating a new one.
- Items are freely convertible between types (e.g. Task ↔ Reminder) and
  support custom fields.
- Items can be embedded/attached to one another in any combination:
  Artifacts → Files/Reminders/Tasks/Projects; Reminders → Projects,
  Artifacts, Memories; etc. Fully cross-linked graph, not a rigid hierarchy.
- **Product principle**: tools should proactively deliver the thing, not ask
  permission first ("I have X, do you want it?"). If the model can think to
  ask, it can provide it — the user was going to say yes anyway, and can
  ignore it if not.
- **List views are full tables, not partial ones.** A form's fields
  naturally become a table's columns — every field the item type defines
  gets a column, sortable (tap header, toggles direction) and filterable,
  not a curated subset. Concretely, per type (`state.tsx`'s field
  definitions):
  - Reminders: title, due, priority, status/progress, tags, project.
  - Memories: content, source model, priority, tags, project.
  - Projects: name, task count/completion, linked items.
  - Artifacts: title, kind, source model, project, last updated.
  **Current gap**: only `RemindersScreen.tsx` has any sortable table
  header, and even it only covers 4 of the type's fields (title/due/
  priority/status) — tags and project aren't columns. Memories, Projects,
  and Artifacts have no table/sort/filter treatment at all, just a plain
  card list.

## Search
- Global search (`InlineSearch.tsx`, docked inline below the grid header,
  not a full-screen modal) with filters by type (conversation history, Smart
  Gen tool type) and model. Streaming/live-filtered as you type; the results
  tray only renders when there's something to show — no "No results found"
  empty-state box for an unfiltered/no-match state.

## Consensus feature ("Collide")
"Collide" is the button/trigger; "Consensus" is the full-screen result it
opens — same action, two names for two halves of it. One button, one
destination.

Full-screen drawer, opened on demand (costs one message for free-tier users,
same as any other general-chat send — Collide isn't free to trigger). Layout
top to bottom:
1. Score (e.g. `4/7`) — its own centered line, red→green colored by
   alignment strength. Not squeezed into a row with other elements.
2. Consensus summary — narrower, centered box below the score, aligned under
   the map's own center column.
3. The dissent map — 2.5D constellation on a black background, given the
   majority of the screen's vertical space (map > score > summary in
   footprint). Center node uses blue/red duality (binary agree/disagree is
   literally what this feature measures). Each dissenting model = a sphere
   with its abbreviated name, vertical position = agreement level, horizontal
   position = force-directed based on mutual agreement with other dissenters.
   Dissenting-view text can render inline next to each sphere (toggleable —
   "LABELS ON/OFF") in addition to always being listed below the map.
- Built from plain View/LinearGradient, not `react-native-svg` — SVG
  primitives (Circle/Line/SvgText/RadialGradient) render blank on web in
  this project's environment.

## Collide preview bar (`CollideBanner.tsx`)
Sits above the composer, always rendered — the synthesis is surfaced before
the user has to ask for it, not locked behind opening the full Consensus
drawer. Tapping it opens that drawer.

- Same two-state rule as the full Consensus drawer: **complete** (every
  selected model has replied — a real reply or an error both count, nothing
  left pending) or **incomplete**. No partial/in-progress wording ("waiting
  on 2 of 5") — the reason the scope isn't complete doesn't change what's
  true, so it collapses to one word.
- The `"Consensus: "` prefix and the score badge are the bar's permanent
  identity — they never disappear, in either state.
- Score badge: a trapezoid tab sitting above the bar (touching, not
  overlapping into it), showing the fraction (e.g. `2/3`), colored
  red→green by alignment strength. Renders `–/–` when incomplete.
- When complete, one small dot renders per replying model below the verdict
  line — filled in that model's own color if it agreed (≥0.5 alignment
  score) with the consensus, left as a hollow ring if it dissented. The
  fraction is checkable against a literal per-model tally, not asserted on
  its own — a bare "2/3" with no way to see which 2 reads as a guess.
- Static forward chevron (`›`, not `⌄`) below the dot row — no bounce/loop
  animation. A janky, low-framerate-looking motion cue reads as urgency the
  feature doesn't have, so it's stationary; a downward chevron would read
  as "scroll for more of this," so it points forward instead. Visible only
  when complete. This is a "tap to open the full page" affordance, not a
  scroll/expand cue — the preview never grows, reveals hidden lines, or
  gains more text in place. It is already the complete preview. The
  chevron points to a separate destination (the full-screen Consensus
  drawer), not to more of itself; a longer preview would not be a more
  useful one.

## Collide button (the trigger itself)
- Built from View/Animated/LinearGradient, not Skia — `@shopify/react-native-
  skia`'s web build depends on fetching a CanvasKit `.wasm` binary at runtime
  outside Metro's normal bundle graph, and Metro's dev server 404s that
  request in this environment, so it can't initialize on web here.
- Breathing aura + core (brightness/emittance pulse, not scale — the button
  never changes size, only how bright it glows).
- Sparks: thin bright slivers that originate at the core's edge and fly
  outward into the aura, fading — not round "glitter" dots.
- Center mark: a generated impact-burst image (two beams colliding into
  light), composited with real transparency — not a hand-coded glyph.

## Media Gen Market
- Full Grok-"Imagine"-market-equivalent: browse/generate image/video/audio
  content, remix, insert-as-source/insert-as-context.
- Backed by a real Supabase table (`market_items`) with real offset/limit
  pagination (`fetchMarketItems` in `services/market.ts`) — not a hardcoded
  cap. Seeded with 202 items (52 image / 50 video / 50 music / 50 coding) via
  the same free template+placeholder approach the app's own local
  `generateMoreMarketItems` already used (random prompt templates + static
  placeholder assets — picsum.photos for images, a small curated video pool,
  SoundHelix test tracks for music) — zero real generation API cost.
- Credits-gated per the tiers section above.

## Wallpapers & Music
- Premium wallpapers are **live wallpapers** (video loops), each sold as an
  **individual purchase** — not unlocked in bulk by Pro/Elite tier alone.
  Price band: **$2.99–$7.99 per wallpaper**. Gating is per-item
  (`state.ownedWallpaperIds`), not a blanket tier check.
- **Purchase is currently mocked** — `purchaseWallpaper` just adds the id to
  local state, no real money moves. Real IAP (`react-native-iap`, App Store/
  Play Store product config, receipt validation, restore-purchases) is a
  deliberately separate, not-yet-started piece of work: it's a native module
  (breaks the web-preview-only dev workflow this app has used so far, needs
  an EAS/dev-client build to test at all) and involves real payment
  processing, both of which need explicit sign-off before starting, not
  silent implementation.
- Each live wallpaper ships with **at least 5 curated music tracks**. One
  mock wallpaper+tracklist (`premium_mock_aurora`, public sample video +
  SoundHelix test tracks) exists end-to-end for testing the purchase→own→
  play pipeline — no real premium video/audio assets exist yet.
- Background audio player: `expo-av`'s `Audio` API
  (`services/musicPlayer.ts`), not `react-native-track-player` — track-player
  needs the same native-dev-client build that IAP does, which this project's
  workflow can't currently produce; expo-av is already a dependency and
  covers every requirement (background playback via
  `staysActiveInBackground`, looping, volume) without adding one.
- A persistent corner volume/mute control (`CornerVolumeControl.tsx`) is
  mounted at the app root — visible on every screen once a track has played,
  single tap mutes, long-press expands play/pause + a volume step control.
- Each track can be toggled on/off in the playlist independent of play/pause
  — toggling off a currently-playing track actually stops it.

## Non-goals / clarifications
- Themes = background image swap only. Do not build a secondary
  color-theme system — glass card styling is constant across themes, and
  there is no user-facing accent-hue picker (see Theming above).
- Free tier's 20 msg/day cap applies regardless of number of models
  selected in a single multi-model query.
