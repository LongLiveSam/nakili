# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Long-form writers, journalists, students, researchers, and anyone who thinks by
speaking. The near-term audience is writers working in African languages,
especially Kiswahili, who need dictation that does not depend on a US-centric
cloud service.

## Product Purpose

Nakili turns speech into editable long-form text on the user's own device. It
exists so a writer can dictate a draft, check it against the original audio, and
publish without sending their voice to a server. Success is a first draft that
is faster to produce than typing and easier to trust than a cloud transcript.

## Positioning

Local-first dictation with clip-level audio evidence: every phrase maps to the
30-second clip it came from, and the audio never leaves the browser. The local
Whisper engine extends coverage to African languages the browser recognizer does
not serve.

## Operating Context

Used at a desk or on a laptop, often in a quiet room, for sessions of 10 to 60
minutes. The writer speaks, pauses, edits, and exports. Recordings live in
IndexedDB; the app is installable as a PWA and works offline after the first
visit. Chrome or Edge is required for live dictation; the local engine handles
audio import and re-transcription.

## Capabilities and Constraints

- Live transcription through the Web Speech API; local Whisper for clip
  re-transcription and audio import.
- 30-second clips mapped to transcript segments; click a sentence to hear the
  moment.
- Voice commands, auto paragraphs, filler removal, vocabulary correction, smart
  typography, and an optional transform script.
- Exports: text, Markdown, DOCX, MP3, WAV, original audio, and a full backup.
- Four skins today (Paper, Primer, Neutral, Nothing); this round replaces the
  Nothing-led system.
- No account, no server, no sync; audio and text stay in the browser.
- Chrome and Edge are supported; other browsers get a blocking notice.
- African language coverage in the local engine: Kiswahili, Amharic, Hausa,
  Somali, Yoruba, Lingala, Malagasy, Shona, and Afrikaans.

## Brand Commitments

- Name: Nakili, Swahili for “transcribe”.
- Mission: make dictation available in as many African languages as possible.
- Voice: plain, direct, respectful; no hype and no gamification.
- Visual world: Broadcast Desk — warm near-black or cool studio-wall light,
  signal red for the tally and the primary action, Source Serif 4 for the
  transcript, Archivo Narrow for the interface, IBM Plex Mono for timecode.
  Light, dark and system modes. The former Nothing design language is retired.

## Evidence on Hand

- Live app: https://longlivesam.github.io/nakili/
- Source: React 19, TypeScript, Vite, Zustand, Dexie, Vitest.
- Real seeded content in the app: “Notes on quiet software”, “Morning pages —
  November 12”, “Interview: building for one user”, “A short guide to
  clip-based editing”.
- No customer testimonials, benchmarks, or press. Do not invent them.

## Product Principles

1. The audio is the evidence; the text is the work.
2. Local by default, not as a setting.
3. The interface disappears into the writing.
4. African languages are the mission, not a market segment.
5. Every feature must survive offline.

## Accessibility & Inclusion

- Keyboard-first editing, visible focus, and 44px touch targets on phones.
- WCAG AA contrast and reduced-motion support.
- Language coverage is an accessibility issue, not only a feature.
