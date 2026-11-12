# Nakili

**Nakili** is Swahili for “transcribe”. It is a private, local-first dictation
app for long-form writing: speak, watch the words appear, edit the transcript
like a document, and keep the original audio one click away as clips mapped to
your text.

Nakili is built for African languages. The local Whisper engine already
supports Kiswahili, Amharic, Hausa, Somali, Yoruba, Lingala, Malagasy, Shona
and Afrikaans, and the language list is meant to grow until Nakili works in as
many African languages as possible.

**Live:** https://longlivesam.github.io/nakili/

## What it does

- **Dictate.** Words appear as you speak. Say “new paragraph” or “period” and
  Nakili writes the structure for you.
- **Check the audio.** Click any sentence to highlight the clip it came from,
  listen to the exact moment, and fix the words in place.
- **Import a recording.** Drop in an existing audio file; Nakili splits it into
  clips and transcribes it on your device with the local Whisper engine.
- **Read it back.** Narrate the transcript with the system voice.
- **Export.** Text, Markdown, Word, MP3, WAV, or the original audio.
- **Work offline.** Install it as a PWA; the shell and your recordings stay
  available without a network.

## Privacy

Everything stays in your browser's IndexedDB. No account, no server, no sync.
Speech-to-text is your browser's own service. Clearing site data deletes all
recordings. Audio export (MP3/WAV) is encoded locally via lamejs — nothing is
uploaded.

The optional local Whisper engine downloads its model from HuggingFace once and
caches it in the browser; after that, clip re-transcription and audio import run
fully offline. The model can be removed again from Settings.

## Languages

Nakili is being built for African languages first. The local engine currently
supports:

| Language | Code |
| --- | --- |
| Kiswahili | `sw` |
| Amharic | `am` |
| Hausa | `ha` |
| Somali | `so` |
| Yoruba | `yo` |
| Lingala | `ln` |
| Malagasy | `mg` |
| Shona | `sn` |
| Afrikaans | `af` |

The browser recognizer (Chrome or Edge) covers a wider set of locales, and the
list is meant to grow. Where the browser does not offer a language, the local
engine is the path that does not depend on the browser vendor.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest suite
npm run build      # production build to dist/
./scripts/live.sh  # build, serve dist/ on :4173, open a public HTTPS tunnel
```

Requires **Chrome or Edge** for live dictation (Web Speech API).

Deployment options are documented in [docs/DEPLOY.md](docs/DEPLOY.md).

## Using it

- **New recording** → speak → **Stop** saves transcript + audio.
- **Import audio** → pick an existing file; it is decoded, split into 30-second
  clips and transcribed on this device with the local Whisper engine. Enable
  that engine in **Settings → Local engine** first (one model download, then
  offline).
- Click anywhere in a transcript; the matching clip highlights in the Clips
  panel for instant playback (“~” = approximate match after edits).
- **Read aloud** narrates the transcript with the system voice.
- Export from the editor or the ⋮ menu: text, Markdown, Word, MP3, WAV or the
  original audio. Exports always download; nothing is shared through the Web
  Share API.

## Design

Nothing design language: monochrome, typographic, industrial — Doto / Space
Grotesk / Space Mono, OLED-dark and paper-light themes, segmented progress
bars, inline `[STATUS]` text instead of toasts.

## Roadmap

- More African languages, starting with the ones the local engine already
  supports.
- Manual audio-only recording for browsers without the Web Speech API.
- Opt-in cloud re-transcription (“enhance accuracy”) with a user-supplied API
  key — intentionally not built, to keep the app free and private.

## License

MIT. See [LICENSE](LICENSE).
