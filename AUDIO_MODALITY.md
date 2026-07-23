# Audio as a modality — curation & rationale

## The error I made, and its cause

I reported that 4 Pro + 4 Elite was "not achievable" for Audio because OpenRouter lists only two music-generation models. That was true and irrelevant. I researched *music* because the code's internal category id was `"music"` — and then reported a limit of the catalog when I had found a limit of my own scope.

The label was doing real damage, not cosmetic damage. `CATEGORIES` already displayed "Audio" to the user while the type said `"music"`, so the app promised a modality and the roster shopped for a genre.

**Audio surface actually available on OpenRouter: ~13 models across 3 call shapes.**

| Surface | Endpoint | Count |
|---|---|---|
| Music generation | `chat/completions` + `modalities:["audio","text"]` | 2 |
| Conversational audio out | `chat/completions` + `modalities:["audio","text"]` | 2 |
| Text-to-speech | `audio/speech` (raw byte stream) | 8+ |

## Curated roster — 4 + 4

Selection targets *coverage of the modality*, not slot-filling. Between them these cover music at clip and song length, low-cost narration, multilingual breadth, emotional direction, voice cloning, and conversational speech.

**Pro — cost-efficient, high-volume**

| Model | Slug | Why it earns the slot |
|---|---|---|
| Lyria 3 Clip | `google/lyria-3-clip-preview` | Music entry point. $0.04 / 30s clip. |
| GPT-4o Mini TTS | `openai/gpt-4o-mini-tts-2025-12-15` | Cheapest quality narration at $0.60/M. The workhorse. |
| Kokoro 82M | `hexgrad/kokoro-82m` | 8 languages, 54 voices, $0.62/M. Multilingual breadth at near-zero cost. |
| GPT Audio Mini | `openai/gpt-audio-mini` | Conversational voice output, $0.60/M in. |

**Elite — flagship fidelity, or a capability no Pro model has**

| Model | Slug | Why it earns the slot |
|---|---|---|
| Lyria 3 Pro | `google/lyria-3-pro-preview` | Full songs with verse/chorus/bridge structure. |
| Gemini 3.1 Flash TTS | `google/gemini-3.1-flash-tts-preview` | 70+ languages, 200+ inline emotion tags (`[whispers]`, `[laughs]`), 2 speakers. Most directable model available. |
| Voxtral Mini TTS | `mistralai/voxtral-mini-tts-2603` | Zero-shot voice cloning — a capability nothing else here has. $16/M justifies the tier. |
| GPT Audio | `openai/gpt-audio` | Flagship conversational audio, $32/M in. |

### Deliberately rejected

- **Orpheus 3B, Sesame CSM 1B, Zonos Hybrid, Zonos Transformer** — all $7/M, English-only, ≤7 voices. Strictly dominated by Kokoro at $0.62/M with 8 languages and 54 voices. Exposing four near-identical English-only models at 11× the price is choice without meaning.
- **GPT-4o Audio Preview** — accepts audio input but *"audio outputs are currently not supported."* It would be a dead option in a generation tab.

## Two slug traps

`openai/gpt-4o-mini-tts-2025-12-15` and `mistralai/voxtral-mini-tts-2603` carry non-obvious suffixes. OpenRouter's own docs call the first one out by name as a common 404 cause. Both are wired with the full slug.

## Code changes

- `Category` type: `"music"` → `"audio"`, propagated through `state.tsx`, `features.tsx`, `PromptComposer.tsx`, `MarketScreen.tsx`, `App.tsx`. Model ids `mus/*` → `aud/*`.
- `CATEGORY_MIN_TIER` had an **unquoted** `music:` key the string rename missed — caught by the typechecker, fixed. Left unfixed it would have silently dropped the Pro gate on the whole Audio category.
- New provider `openrouter-speech` with `callOpenRouterSpeech()`. TTS returns a raw audio byte stream, not JSON — a genuinely different call shape, so it gets its own provider rather than a flag on the existing one. Routes gain an optional `voice` field since each TTS model exposes its own voice set.
- `openrouter-music` → `openrouter-audio` (it now serves music *and* conversational voice).

## Dangling references found while renaming

The market seed data in `state.tsx` referenced **twelve models that don't exist in the roster**:

`img/dalle-3`, `img/imagen-3`, `img/sdxl`, `img/midjourney-v6`, `img/flux-dev`, `img/flux-schnell`, `vid/luma-dream`, `vid/kling-ai`, `aud/musiclm`, `aud/riffusion`, `pro/gpt-5-code`, `pro/claude-4.5-code`, `elite/o1-code`, `pro/gpt-5`

These are largely the invented ids `models.ts`'s own comment says were removed for having no real route — the roster was cleaned, the seeds never were. Every Market card citing one attributed itself to a nonexistent model, and "insert as source" would have resolved to nothing. All repointed to real models.

**Verified programmatically: zero dangling model references remain anywhere in the app.**

## Verification

Typecheck against the untouched original: **96 errors before, 96 after** — identical count, all pre-existing (missing `@types`, `children` prop patterns, `key` in prop types). No new errors introduced.

That is a type check, not proof of behaviour. The TTS path in particular is unexercised — `callOpenRouterSpeech` needs one live call per model to confirm the voice ids (`alloy`, `af_bella`, `Zephyr`) are accepted, since voice sets are per-provider and a wrong voice is a 400.
