# Changelog

Nakili uses decimal minor steps: `0.01`, `0.02` … `0.09`, `0.1` … `0.5`, `1.0`.
`npm run release -- bump` moves one step; `npm run release -- set 0.5` jumps.
Every release is a git tag (`v0.01`, `v0.5`, `v1.0`).

## v0.07 — 2026-11-12

- Welcome home: the landing page is now the permanent Home, with Recordings as its own view. Brand teal #2aa2a4 replaces the orange accents. The last Nothing signatures are gone: the dot pattern, bracketed status text and bracketed close buttons.

## v0.06 — 2026-11-12

- Taste pass: one aligned shell container, 7:1 light-mode secondary text, hidden import input out of the tab order, tighter landing rhythm, a reduced-motion-safe hero entrance, and a 1200x630 social card.

## v0.05 — 2026-11-12

- Broadcast Desk: a new visual world with warm studio light and dark modes, a signal-red tally, a serif transcript, a cue-sheet clip stack, icons on Download and Rename, and a system-default color mode. PRODUCT.md and DESIGN.md added; the Nothing design language is retired.

## v0.04 — 2026-11-12

- Impeccable slop pass: removed the decorative blinking caret from the landing preview, tightened the preview line break, and recorded the deliberate brand-font exception (Inter for the paper skin, Space Grotesk for Nothing) in the detector config.

## v0.03 — 2026-11-12

- README rewritten around the mission: Nakili is Swahili for transcribe, built for African languages. Added Kiswahili, Amharic, Hausa, Somali, Yoruba, Lingala, Malagasy, Shona and Afrikaans to the local engine and recognition list. Removed internal versioning notes and the contact address.

## v0.02 — 2026-11-12

- Pause-aligned clip chunking: pausing closes the current clip and resuming starts a new one at the recorded offset, so clip offsets and transcript timestamps no longer drift. Paused time is excluded from speech timestamps and stored clip starts are real.

## v0.01 — 2026-11-12

- First versioned release: local-first dictation PWA with live transcription,
  30-second clip playback mapped to the transcript, and in-place editing.
- Four skins (Paper, Primer, Neutral, Nothing) with independent light/dark mode.
- Voice commands, auto paragraphs, filler removal, fuzzy vocabulary correction,
  smart typography, and an optional transform script.
- Local Whisper engine: model and precision choice, cached-model manager,
  silence trimming, clip re-transcription, and audio-file import.
- Read aloud with the system voice.
- Exports: text, Markdown, Word (.docx), MP3, WAV, original audio, full backup.
- Audio retention window, storage-pressure warnings, settings salvage at boot.
- Installable PWA with offline shell; deployed to GitHub Pages.
