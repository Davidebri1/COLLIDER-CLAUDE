# Collider — Task Tracker

Status against [SPEC.md](SPEC.md) (requirements) / [PLAN.md](PLAN.md) (path to submission).
Updated the moment status changes. `unverified` = present in code, not re-checked against SPEC.md wording this session — treat as a to-do, not a pass.

## Blockers — must resolve before shipping

| # | Status | Item | Detail |
|---|--------|------|--------|
| B1 | 🔴 not started | API keys hardcoded in client | [chat.ts:28-35](src/services/chat.ts#L28) — OpenRouter + 2 Groq + Exa + Tavily keys ship in the binary, extractable by anyone. Needs a server-side proxy. Real architecture change — scope before starting. |
| B2 | 🔴 blocked | Default tier = `elite` | [state.tsx:365](src/state.tsx#L365) — ships unlimited elite access for $0. Left as-is: another session is mid-validation on it. Do not revert without confirming that's done. |
| B3 | ⚪ deferred | Real IAP | [iap.ts](src/services/iap.ts) — connection scaffolding only, no receipt validation/restore. SPEC.md defers this pending your sign-off. Blocker whenever that happens. |
| B4 | 🔴 not started | Native build unverified | Everything tested via web preview only. `expo prebuild`/`run:ios`/`run:android` never confirmed working — native-only deps (Skia, expo-av, future IAP) untested in a real build. |

## Video/music generation (this session's work)

| # | Status | Item | Detail |
|---|--------|------|--------|
| V1 | ✅ done | Video roster matches SPEC ("3 pro, 3 elite") | Added Veo 3.1 Lite / Kling v3.0 Standard / Grok Imagine Video (pro) + Kling v3.0 Pro (elite). IDs confirmed against OpenRouter's live catalog. |
| V2 | ✅ verified live | Veo 3.1 Lite route fires end-to-end | Real job → completed → `video/mp4` served. Cost $0.32. |
| V3 | ⚪ untested | Kling v3.0 Standard, Grok Imagine Video, Kling v3.0 Pro | Same code path as V2 (proven mechanism), but each model ID itself unfired. Ask before spending again. |
| V4 | ✅ done | Real video/music generation wired | `callOpenRouterVideo`/`callOpenRouterMusic` in chat.ts replace the old text-model storyboard/lyrics fake. |
| V5 | ✅ done | Tier-gating logic correct | `canUse`/`isCategoryUnlocked` separate cost-tier from access-tier correctly (the free-tier-coding-access bug is fixed). Only the *default value* is wrong — see B2. |

## Feature areas — unverified against current SPEC.md wording

| Area | Status | Note |
|------|--------|------|
| Grid view | ⚪ unverified | Model selector, category dropdown, glass cards, scroll-to-top. Present in code (CardGrid/ModelTray/Picker), not re-checked. |
| Card detail view | ⚪ unverified | Single-model chat, local Smart Gen drawer scope. |
| Theming | ⚪ unverified | Palette rule, no accent picker, Manrope weights. Recent commits suggest active work; not independently re-checked. |
| Drawers | ⚪ unverified | Left (Settings/History/Consensus), right (Smart Gen, global vs. per-card). |
| Smart Gen Suite | 🟡 partial | Screens exist; autogeneration/dedup/cross-linking claimed fixed in recent commits — worth re-auditing for other silently-inert fields (pattern already found twice: Skills tab, customInstructions). |
| Smart Gen full-field tables | 🔴 not started | New SPEC.md requirement — every list view needs full sortable/filterable columns. Only RemindersScreen has partial support (4 of its fields). Memories/Projects/Artifacts have none. |
| Reminders push notifications | ⚪ unverified | `scheduleReminder` in media.ts. SPEC.md accepts no offset/repeat/toggle yet — confirm still in scope. |
| Global search | ⚪ unverified | InlineSearch.tsx — inline docked, type+model filters. |
| Consensus/Collide feature | ⚪ unverified | Score, summary, 2.5D dissent map. Heaviest-iterated area (7+ commits) — likely closest to spec-complete, worth one full re-read. |
| Collide button visual | ⚪ unverified | Aura, sparks, impact-burst mark. View/Animated only, no Skia (by design). |
| Media Gen Market | ⚪ unverified | Supabase-backed, real pagination claimed. Seeded count/category split not re-checked. |
| Wallpapers & Music | 🟡 partial | Per-item purchase gating real; purchase itself mocked pending B3. One mock wallpaper+tracklist works end-to-end. |

## Done / confirmed this session

- Categories/tabs independently scoped (General/Image/Video/Audio/Coding)
- Model roster curated against live OpenRouter catalog, no fake/dead routes
- Video tier counts match SPEC.md exactly, with one route live-fire verified

## Process note

SPEC.md is the canonical requirements doc — read it and this file before starting work, update this file the moment status changes. Legend: ✅ done · 🟡 partial · 🔴 not started/blocked · ⚪ unverified/deferred.
