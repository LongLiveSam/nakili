# Nakili

Private, local-first dictation for long-form writing. Speak, watch words appear
in real time, edit the transcript like a document — with the original audio
always one click away as 30-second clips mapped to your text.

## Run it

```powershell
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest suite
npm run build    # production build to dist/
```

Requires **Chrome or Edge** (uses the Web Speech API).

## Using it

- **New recording** → speak → **Stop** saves transcript + audio.
- Click anywhere in a transcript; the matching 30 s clip highlights in the
  Clips panel for instant playback ("~" = approximate match after edits).
- Export via **Share** (editor) or the ⋮ menu: `.txt` transcript / `.webm` audio.

## Privacy

Everything stays in your browser's IndexedDB. No account, no server, no sync.
Speech-to-text is your browser's own service. Clearing site data deletes all
recordings. Audio export (MP3/WAV) is encoded locally via lamejs — nothing
is uploaded.

## Design system

Nothing design language (`Nothing design` skill): monochrome, typographic,
industrial — Doto / Space Grotesk / Space Mono, OLED-dark + paper-light themes,
segmented progress bars, inline `[STATUS]` text instead of toasts.

## Roadmap (deferred by decision)

- Voice-activity auto-pause during long silences.
- Manual audio-only recording mode for browsers without Web Speech API.
- Opt-in cloud re-transcription ("enhance accuracy") using a user-supplied
  API key — intentionally not built to keep the app fully free and private.

## Contact

culturedrabbit@gmail.com
