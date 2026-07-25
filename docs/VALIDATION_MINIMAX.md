# MiniMax M3 logic-chain validation

Smart Gen's single judge is MiniMax M3 (`minimaxai/minimax-m3` via NVIDIA NIM, with the identical model via OpenRouter as the web/CORS fallback — see `src/services/minimax.ts`). Because one model performs every Smart Gen judgment — background extraction, board chat, consensus arbitration — qualifying the model once qualifies every judgment it makes, regardless of which surface a message came through.

## Method (record, don't grade)

`scripts/validate-logic-chain.mjs`:

1. Send one fixed probe message, cold, under the same Smart Gen posture the model runs with in-app (act directly, never dangle offers).
2. Capture the reply.
3. Ask "why?" five times in a row — each why targets the previous answer.
4. Record every chain verbatim. **No response is ever graded.**
5. Repeat for N independent replications (target 100).

Probe: *"My landlord still hasn't returned my security deposit and it's been 45 days. I think the small-claims filing deadline in my state is August 15."*

The only thing measured is **convergence**: does the final "why" bottom out at the same root across replications? A model with an intact causal chain lands on the same root regardless of surface phrasing. Convergence is computed mechanically as mean pairwise token-overlap per why-depth plus the frequency of terms across final answers — a floor estimate, since token overlap can't see two phrasings of the same idea.

## Run log

- **Run 1** (100 reps, concurrency 8): aborted — the free NVIDIA key hard-429s under burst load. Finding recorded: the key sustains paced sequential traffic (~1 request start / 4s) but not parallel bursts. The in-app client got retry + OpenRouter fallback out of this.
- **Run 2** (100 reps, concurrency 3, 4s global pacing): in progress at time of this commit — each replication is 6 sequential reasoning-model calls (~3 min/rep). Raw chains stream into `scripts/out/logic-chain-2026-07-24T21-47-00-314Z.jsonl`; the final summary JSON lands beside it and this section gets updated when the run completes.

## Readout at 37 replications (run continuing toward 100)

Mean pairwise token-overlap by why-depth:

| depth | overlap |
|---|---|
| why 1 | 0.175 |
| why 2 | 0.132 |
| why 3 | 0.086 |
| why 4 | 0.064 |
| why 5 | 0.061 |

Term frequency across final (depth-5) answers: `legal` 51%, `system` 35%, `disputes` 27%, `courts` 22%, `evidence` 22%, `people` 24%.

Sample final why, verbatim: *"Because the legal system is built on the principle that disputes are resolved through verifiable facts presented by both sides, not by who seems more believable — so the party with paper wins when memories conflict."*

Observed pattern so far, stated without judgment: surface phrasing diversifies as the chain deepens (token overlap falls), while the final answers keep drawing from one small vocabulary cluster around the same root — the legal system resolving disputes through verifiable evidence. The raw chains are in the JSONL for anyone to read the roots directly; token overlap is the floor, not the ceiling, of agreement.

## Reproducing

```
node scripts/validate-logic-chain.mjs [replications=100] [concurrency=3]
# key via NVIDIA_API_KEY / EXPO_PUBLIC_NVIDIA_API_KEY, else the shipped key
# pacing via PACE_MS (default 4000 — do not lower on the free key)
```
