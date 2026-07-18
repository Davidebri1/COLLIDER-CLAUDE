# Collider — Plan

Source of truth for requirements is [SPEC.md](SPEC.md). This file exists to
connect that spec to current implementation status and the path to
submission. Read both before starting work in this repo. Update this file
(not conversation memory) when status changes.

## Goal
Ship Collider to app store submission. Store target and target date: not yet
specified by the user — ask before assuming either.

## What "done" means for submission
1. Every feature in SPEC.md is implemented and matches the spec, or is
   explicitly marked out of scope for v1 in TASKS.md with the user's sign-off.
2. No mocked/placeholder behavior remains in a path a real user can reach
   without the app being clear it's a placeholder (e.g. mocked wallpaper
   purchases are acceptable per SPEC.md only because SPEC.md says IAP is
   explicitly deferred pending sign-off — that is the one sanctioned
   exception, not a precedent for others).
3. No dev/test scaffolding left wired into default state (see the tier
   default bug in TASKS.md).
4. App builds via `expo prebuild` + native build for the target store(s),
   not just the web preview workflow used during iteration.

## How this repo will be worked going forward
- SPEC.md is read at the start of substantive work, not recalled from memory.
- TASKS.md is updated the moment a task's status changes — not batched, not
  deferred to "later in the conversation."
- Multi-file changes: read every file the change touches first, make the
  edit consistent across all of them in the same turn, don't leave a partial
  cross-file state for a later message to clean up.
- No feature is reported done without checking it against SPEC.md's actual
  wording for that feature, not against what "seems reasonable."
