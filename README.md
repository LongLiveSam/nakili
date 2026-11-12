# Nakili

Private, local-first dictation for long-form writing. Speak, watch words appear
in real time, edit the transcript like a document — with the original audio
always one click away as 30-second clips mapped to your text.

**Live:** https://longlivesam.github.io/nakili/

## Run it

```powershell
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest suite
npm run build    # production build to dist/
./scripts/live.sh  # build, serve dist/ on :4173, open a public HTTPS tunnel
```

Requires **Chrome or Edge** (uses the Web Speech API).

Deployment options and the local production server are documented in
[docs/DEPLOY.md](docs/DEPLOY.md).

## Versioning

The app version is shown in the footer and in Help. It uses decimal minor
steps, so small changes move `0.01 → 0.02`, larger milestones jump to `0.5`,
and a rewrite can go to `1.0`. Every release is a git tag and a changelog entry.

```bash
npm run release -- bump --note "what changed"   # +0.01
npm run release -- set 0.5 --note "public beta" # jump
npm run release -- bump --dry-run               # preview only
```

The script updates `package.json`, `package-lock.json` and `CHANGELOG.md`,
commits `chore: release vX`, and creates the tag `vX`. Push with:

```bash
git push --follow-tags
```

The current version is the single source of truth in `package.json`; Vite
injects it as `__APP_VERSION__` at build time.

## Using it

- **New recording** → speak → **Stop** saves transcript + audio.
- **Import audio** → pick an existing file; it is decoded, split into 30-second
  clips and transcribed on this device with the local Whisper engine. Enable
  that engine in **Settings → Local engine** first (one model download, then
  offline).
- Click anywhere in a transcript; the matching 30 s clip highlights in the
  Clips panel for instant playback ("~" = approximate match after edits).
- **Read aloud** narrates the transcript with the system voice.
- Export from the editor or the ⋮ menu: `.txt` transcript / `.webm` audio.
  Exports always download; nothing is shared through the Web Share API.

## Privacy

Everything stays in your browser's IndexedDB. No account, no server, no sync.
Speech-to-text is your browser's own service. Clearing site data deletes all
recordings. Audio export (MP3/WAV) is encoded locally via lamejs — nothing
is uploaded.

The optional local Whisper engine downloads its model from HuggingFace once and
caches it in the browser; after that, clip re-transcription and audio import run
fully offline. The model can be removed again from Settings.

## Design system

Nothing design language (`Nothing design` skill): monochrome, typographic,
industrial — Doto / Space Grotesk / Space Mono, OLED-dark + paper-light themes,
segmented progress bars, inline `[STATUS]` text instead of toasts.

## Roadmap (deferred by decision)

- Manual audio-only recording mode for browsers without Web Speech API.
- Opt-in cloud re-transcription ("enhance accuracy") using a user-supplied
  API key — intentionally not built to keep the app fully free and private.

## Contact

culturedrabbit@gmail.com
