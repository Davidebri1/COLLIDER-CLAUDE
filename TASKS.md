# Collider — Task Tracker

Status against [SPEC.md](SPEC.md) (requirements) / [PLAN.md](PLAN.md) (path to submission).
Updated the moment status changes. `unverified` = present in code, not re-checked against SPEC.md wording this session — treat as a to-do, not a pass.

## Blockers — must resolve before shipping

| # | Status | Item | Detail |
|---|--------|------|--------|
| B1 | 🔴 **CREDENTIALS LEAKED — ACTION NEEDED FROM YOU** | API keys hardcoded in client, publicly exposed | chat.ts code fixed (reads `EXPO_PUBLIC_*` env vars now), but that fix sat **uncommitted** while HEAD — already pushed to the **public** `Davidebri1/COLLIDER-CLAUDE` repo, both `main` and this branch — still has all 5 real keys in plaintext, present since the initial commit. **Rotate all 5 keys (2× Groq, OpenRouter, Exa, Tavily) at each provider's dashboard now** — they are burned regardless of any code fix. Decide if the repo should be private. Code fix itself is verified working (dev server confirmed loading `EXPO_PUBLIC_*` from `.env` correctly). |
| B2 | ✅ done | Default tier = `elite` | Changed state.tsx:365 from `tier: "elite"` to `tier: "free"` with matching credits pool. Users now start on free tier. |
| B3 | ⚪ deferred | Real IAP | [iap.ts](src/services/iap.ts) — connection scaffolding only, no receipt validation/restore. SPEC.md defers this pending your sign-off. Blocker whenever that happens. |
| B4 | 🔴 not started | Native build unverified | Everything tested via web preview only. `expo prebuild`/`run:ios`/`run:android` never confirmed working — native-only deps (Skia, expo-av, future IAP) untested in a real build. |

## Full AI-Firstify audit + bug investigation (this session)

Structural audit: Project Structure GREEN, Agent Architecture GREEN (adjusted — LLM calls are the product, not a defect), Skill Usage YELLOW (no `.claude/skills/` despite recurring workflows: palette sweeps, model-roster sync, spec/task reconciliation), Scope & Complexity YELLOW (dead code found, see below), Context Hygiene GREEN, Safety RED (see B1), Workflow Design YELLOW (no tests/CI at all).

Dead code found (Scope & Complexity dimension) — not yet removed, flagging for a cleanup pass:
- `CollideButton` (App.tsx:624-650) and its style `collideTrackBtn` (theme.ts:236) — orphaned, superseded by `CollideBanner.tsx`.
- `CategoryTabs() { return null; }` stub (App.tsx:1384-1386) — leftover from the pre-dropdown ribbon selector.
- `CardScreen`'s `consensus`/`setConsensus` state + `<ConsensusModal>` render (App.tsx ~2263, ~2792-2795) — unreachable, no call site ever sets it true.
- `@shopify/react-native-skia` and `react-native-reanimated` in package.json — zero imports anywhere, should be uninstalled before the native build (B4).
- SPEC.md's model-count table is stale vs. `src/models.ts`: Audio is 2 models total vs. spec'd 6; Image is 3 pro vs. spec'd 2.
- SPEC.md's "Collide button (aura, sparks, impact-burst)" section has no matching implementation anywhere — `CollideBanner.tsx` implements a different, separate spec section.

Bug investigation — all 3 user-reported issues confirmed and fixed:

| Bug | Root cause | Fix |
|-----|-----------|-----|
| Internet search | Code was correct end-to-end (toggle→state→search→prompt injection) and the Exa key was live/valid — but an uncommitted JSX-comment syntax error in App.tsx (`{/* */}` as first token inside a non-JSX `&&(...)` expression, ~line 1935) was breaking the Metro bundle entirely, so nothing ran. Also: web-search toggle appeared on Image/Video/Music tabs but silently no-ops there (chat.ts returns before checking it). | Fixed the App.tsx syntax error; verified live in-browser — 3/3 models returned real grounded current-events content. Gated the toggle to General/Coding only in PromptComposer.tsx. |
| Research mode | Two mechanisms shared the name: the per-message mode pill (chevron chip while chatting) was fully wired and works (forces search, reshapes prompt, saves research artifacts). But Settings' "Default chat mode" control wrote to `globalDefaultChatMode`, which nothing ever read — dead end, same "state written, nothing reads it" bug class as the earlier Skills/customInstructions issue. | Wired `globalDefaultChatMode` into the `newConversation` reducer (state.tsx) so it now actually seeds new conversations' chat mode. |
| Discover Market | Backend fully healthy (202 real rows, RLS correct, live-verified via direct API calls) — but `market.ts`'s search filter string-interpolates the raw search term into a PostgREST `.or()` expression with no escaping; any comma in a search term (e.g. "cool, right") breaks the filter-tree parser → HTTP 400, live-reproduced. On any failure, `MarketScreen.tsx` silently swaps in fake filler data — `usingFallback` state was set but never rendered, and the "offline sample data" toast only fired on initial load, never on pagination failures. | Escaped/quoted the search term in market.ts. Added a persistent "Live feed unavailable" banner tied to `usingFallback`, and made the toast fire on every fallback, not just reset. |

All fixes typechecked clean (`tsc --noEmit`) and the search fix was verified live in a running dev server. Uncommitted — see B1 above for why nothing has been pushed yet.

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
