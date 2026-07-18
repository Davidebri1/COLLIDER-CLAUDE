# Collider — Task Tracker

Tracks implementation status against [SPEC.md](SPEC.md) (requirements) and
[PLAN.md](PLAN.md) (path to submission). Updated the moment status changes —
not batched to end of session. If a task's status here is stale, that's a
bug in how this file is being maintained, say so.

Status values: `done`, `in-progress`, `blocked`, `not-started`, `deferred
(sign-off)`.

## Submission blockers (must resolve before shipping)

- **[done] Video category now matches SPEC.md's "3 pro, 3 elite."** Added 3
  real pro-tier routes (Veo 3.1 Lite, Kling Video v3.0 Standard, Grok Imagine
  Video) and 1 real elite route (Kling Video v3.0 Pro) to fill the gap left
  when the fake Runway/Pika/Kling-AI/Luma entries were removed. All 6 IDs
  confirmed live against OpenRouter's own `/api/v1/videos/models` listing
  (fetched 2026-07-18), not guessed — see chat.ts ROUTES and models.ts.
  **Not yet end-to-end tested** (no live send-and-poll confirmed for the 4
  new routes in this session) — verify before marking fully done.
  (Coding checked against the same logic and is NOT a gap: SPEC.md's "2 free,
  4 pro" means 2 cost-free-labeled models within the pro-tier roster plus 4
  more — actual roster has exactly 6 pro-tier coding models, 3 elite, which
  matches once you read "free" there as a cost label, not an access tier —
  see the code comment in models.ts.)
- **[blocked] Default tier hardcoded to `elite` in [state.tsx:365](src/state.tsx#L365).**
  Currently `tier: "elite", credits: TIER_INFO.elite.pool` instead of
  `"free"`. Left in place deliberately by whoever is validating the new
  video/music generation routes (elite-only categories) — do not revert
  without confirming that validation is finished, but this cannot ship as-is:
  every fresh install currently gets unlimited elite access for $0.
- **[not-started] Real IAP** ([iap.ts](src/services/iap.ts)). Connection/
  purchase-request scaffolding exists (`react-native-iap`) but no receipt
  validation, no restore-purchases, no App Store/Play Store product
  configuration. SPEC.md marks this as deliberately deferred pending
  explicit user sign-off — do not start without asking first, but it is a
  hard submission blocker whenever that sign-off happens, since wallpaper
  purchases and Pro/Elite tier purchase are both currently mocked.
- **[not-started] Native build verification.** Everything so far has been
  iterated against the web preview workflow. `expo prebuild` / `expo run:ios`
  / `expo run:android` have not been confirmed to produce a working build in
  this project. Native-only deps already in package.json
  (`@shopify/react-native-skia`, `expo-av`, future `react-native-iap`,
  `react-native-track-player` if ever added) need this checked before
  submission, not assumed.

## Feature areas (per SPEC.md section)

- **[done] Categories/tabs** — General/Image/Video/Audio/Coding, each with
  independently scoped model selection and conversation state.
- **[done] Model roster** — curated against live OpenRouter catalog,
  `src/models.ts` + `chat.ts` `ROUTES`. Recently corrected: video (Sora 2 /
  Veo 3.1) and music (Lyria 3, relabeled from Suno/Udio) now route to real
  generation APIs instead of a text model faking storyboards/lyrics — see
  uncommitted diff in chat.ts/models.ts.
- **[in-progress] Real video/audio generation** — `callOpenRouterVideo` /
  `callOpenRouterMusic` in [chat.ts](src/services/chat.ts) (uncommitted).
  Confirmed live against OpenRouter's async video job API and Lyria 3's
  streaming audio format per the code comments. Not yet verified end-to-end
  in this session — needs a live send-and-play check before marking done.
- **[done] Tier gating logic** — `canUse`/`isCategoryUnlocked` in models.ts
  correctly separate a model's cost tier from its category's minimum access
  tier (the free-tier-coding-access bug from commit d8fccb7 is fixed). Gating
  *logic* is correct; the *default* value is currently wrong (see blockers).
- **[unverified] Grid view** — model selector modal, category dropdown,
  transparent glass cards, top-fill scroll-to-top-of-latest behavior. Present
  in code (CardGrid.tsx, ModelTray.tsx, Picker.tsx); not re-verified against
  SPEC.md wording in this session.
- **[unverified] Card (detail) view** — full single-model chat, local Smart
  Gen drawer scope.
- **[unverified] Theming** — background image swap, no accent-hue picker,
  black/white + silver/chrome palette rule, Manrope 4-static-weight fonts.
  Recent commits (778e836, 90dcb63) suggest active palette-compliance sweeps;
  not independently re-checked against SPEC.md's exact rules in this session.
- **[unverified] Drawers** — left drawer (Settings/Account/Usage + History
  sortable table + Consensus tab lip), right drawer (Smart Gen tools, global
  vs. per-card scope).
- **[partially verified] Smart Gen Suite** — Projects/Tasks/Reminders/
  Memories/Artifacts screens exist. Per SPEC.md: autogeneration from
  conversation context, dedup-before-create, cross-linking, proactive
  delivery. Commit 90dcb63 claims cross-linking wiring fixed; commits e013f5a
  and 79aedcc fixed two separate "collected but never used" bugs (Skills tab,
  customInstructions) — pattern worth re-auditing for other silently-inert
  fields before submission.
- **[unverified] Reminders push notifications** — `scheduleReminder` in
  media.ts. SPEC.md explicitly notes no alert-offset/repeat/toggle options
  exist yet — confirm that's still accepted scope, not a gap to close.
- **[unverified] Global search** — InlineSearch.tsx, inline docked,
  type+model filters, streaming filter, no empty-state box.
- **[unverified] Consensus/Collide feature** — score line, summary box, 2.5D
  dissent map, View/LinearGradient-only (no react-native-svg). Multiple
  recent commits (0ee4949, 97f7f0e, 34d9170, 4f3ff16, 778e836, 90dcb63,
  aa81823) iterated this heavily — likely closest to spec-complete, but
  worth one full re-read against SPEC.md's current wording since it changed
  the most.
- **[unverified] Collide button visual** — breathing aura, spark particles,
  generated impact-burst center mark, View/Animated/LinearGradient only (no
  Skia, confirmed reason in SPEC.md).
- **[unverified] Media Gen Market** — Supabase-backed `market_items`,
  real pagination, 202 seeded items. `services/market.ts` exists;
  not re-verified against the exact seeded count/category split in this
  session.
- **[partially done] Wallpapers & Music** — per-item purchase gating exists
  (`state.ownedWallpaperIds`), one mock wallpaper+tracklist end-to-end,
  `expo-av`-based player with corner volume control. Purchase is
  intentionally mocked pending IAP sign-off (see blockers).

## Process notes
- This file was created because SPEC.md (the actual canonical requirements
  doc, already in the repo) was not being read at the start of sessions.
  Going forward: read SPEC.md and this file before starting substantive work,
  update this file when status changes, don't rely on conversation memory
  for requirement recall.
- "Unverified" above means: present in code per file listing, not
  independently re-checked line-by-line against SPEC.md's current wording in
  this session. Treat as a to-do, not as a pass.
