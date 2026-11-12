# Nakili — Agent Instructions

Local-first dictation web app. React 19 + TypeScript + Vite, Zustand, Dexie (IndexedDB), Vitest.
Design system: Broadcast Desk — warm near-black / warm off-white, brand teal, Source Serif 4
for the transcript, Archivo Narrow for UI, IBM Plex Mono for timecode. Light, dark and system
modes. No gradients/shadows, inline status text instead of toasts.

## Always-on standards

ECC rule packs are installed at `.opencode/rules/ecc/` (local-only, gitignored):

- `.opencode/rules/ecc/common/` — coding style, testing, security, git workflow, patterns
- `.opencode/rules/ecc/typescript/` — TS strict-mode conventions
- `.opencode/rules/ecc/react/` — React rendering/component rules

Read the relevant pack before large changes. Highlights that override anything else:

- Tests must pass (`npm test`) and `npm run build` must succeed before any commit.
- TDD: failing test first for behavior changes.
- Never weaken a test to make it pass; fix the code or justify the change to the user.
- No gradients, no box-shadows, no toast popups — use inline status text.

## Specialized subagents

`.opencode/agent/` (local-only):

- **ecc-build-error-resolver** — minimal-diff build/typecheck repair. Dispatch when tsc/vite fails.
- **ecc-code-reviewer** / **ecc-typescript-reviewer** — fresh-context review after significant changes.

## Project invariants

- Text edits never delete audio chunks/segments; they only shift offsets or set `approximate`.
- IndexedDB database key stays `dictation-scribe` (renaming orphans user data).
- Exports always download (never Web Share); MP3/WAV encoding is local-only via lamejs.
- Chrome/Edge are the supported browsers; everything else gets the blocking notice.
