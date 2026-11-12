# Changelog

Nakili uses decimal minor steps: `0.01`, `0.02` … `0.09`, `0.1` … `0.5`, `1.0`.
`npm run release -- bump` moves one step; `npm run release -- set 0.5` jumps.
Every release is a git tag (`v0.01`, `v0.5`, `v1.0`).

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
