# Dictation Scribe — Design Specification

Date: 2026-08-24
Status: Approved design, pending implementation plan

## 1. Overview

Dictation Scribe is a browser-based dictation tool for creating long-form articles by speaking. The user taps record, speaks, and sees words appear in real time as streaming transcription. After recording, the transcript is freely editable as plain text. Session audio is stored as exactly-30-second chunks; placing the text cursor anywhere in the transcript highlights the corresponding chunk in a clip sidebar for instant playback and correction.

## 2. Decisions (resolved)

| Question | Decision |
|---|---|
| Platform | Web app only (no native iOS/Android) |
| Stack | React 18 + TypeScript + Vite |
| Browser support | Chrome/Edge only; other browsers get an unsupported-browser notice |
| Form factor | Responsive: desktop-first layout, mobile-adapted (clip panel becomes collapsible bottom panel) |
| Speech recognition | Web Speech API (`SpeechRecognition`), online/server-backed — acceptable |
| Editor | Plain text only |
| Export | Transcript text + full concatenated recording via share/download |
| Accounts / sync | None; local-only storage (IndexedDB) |
| Audio format | webm/opus via MediaRecorder (Chrome default) |

## 3. Non-goals

- No cloud sync, no backend, no accounts.
- No rich-text formatting (bold/italic/headings).
- No Firefox/Safari dictation support.
- No waveform visualization.
- No offline speech recognition.

## 4. Architecture

### 4.1 Stack

- **Vite + React 18 + TypeScript**, strict mode.
- **Styling:** plain CSS with custom properties. System font stack (`system-ui, -apple-system, Segoe UI, Roboto, sans-serif`). No CSS frameworks, no gradients, no shadows beyond subtle platform-conventional borders.
- **State:** Zustand stores per feature: `libraryStore`, `sessionStore` (recording), `editorStore`, `playbackStore`.
- **Persistence:** Dexie (IndexedDB). Autosave debounced ~500 ms after each editor change.
- **Routing:** none needed initially — three views switched by app state (Home, Recording, Editor). If routing is later needed, add React Router.

### 4.2 Project structure

```
src/
  features/
    library/        # article list, rename/delete/duplicate/export
    recording/      # recording screen, timer, live transcript
    editor/         # editor screen, cursor tracking
    playback/       # clip sidebar/bottom panel, per-clip player
  core/
    db/             # Dexie schema + repositories
    services/
      SpeechService.ts
      RecorderService.ts
      MappingService.ts   # pure functions
      ExportService.ts    # share/download, full-audio concatenation
    models.ts       # Article, AudioChunk, TranscriptSegment types
  ui/
    components/     # shared presentational components
    UnsupportedBrowserNotice.tsx
  App.tsx
```

### 4.3 Core services

**SpeechService** — wraps `webkitSpeechRecognition`.
- `start(): void`, `stop(): Promise<void>`, `onInterim(text)`, `onFinal(text, elapsedSeconds)`, `onError(err)`.
- Emits interim results continuously; on final results, records the elapsed session time so segments can be mapped to chunks (`chunkIndex = floor(elapsedSeconds / 30)`).
- Auto-restarts on recoverable errors (e.g., `no-speech`, transient network); stops on fatal ones.
- `static isSupported(): boolean`.

**RecorderService** — wraps `MediaRecorder` with exact 30-second rollover.
- `start(): void`, `stop(): Promise<StoredChunk[]>`, `onChunkStarted(index, startTime)`.
- Implementation: `getUserMedia({ audio: true })` → start recorder; after exactly 30 s call `stop()` then immediately `start()` a new recorder on the same stream. Each completed blob is a valid standalone webm/opus file.
- Known trade-off (accepted): a few-millisecond gap at rollover boundaries may clip a word spoken exactly across a boundary. Documented behavior, not a bug.
- Chunks are written to IndexedDB as Blobs under generated keys.

**MappingService** — pure functions (no DOM, no I/O), fully unit-testable:
- `chunkIndexForElapsed(seconds): number`
- `findSegmentForCursor(segments, cursorOffset): { segment | null, approximate: boolean }` — binary search for segment where `startCharOffset <= offset <= endCharOffset`; fallback to nearest preceding segment with `approximate = true`.
- `adjustSegmentsAfterEdit(segments, oldText, newText): Segment[]` — character-level diff between old/new text; shift offsets of all segments after the edit point by the delta length; segments overlapping the edited range are marked `approximate`. Segments are never deleted by edits.

**ExportService**
- Transcript export: `.txt` download; share via `navigator.share` with files when available, download fallback otherwise.
- Full-recording export: concatenate chunk blobs into a single webm file (Blob concatenation of media sections) and share/download.

## 5. Data model (IndexedDB via Dexie)

```
articles: id (uuid), title, createdAt, updatedAt, durationSec, transcriptText

audioChunks: id (uuid), articleId, index, startTimeSec, endTimeSec,
             blobKey (key into audioFiles table), durationSec

transcriptSegments: id (uuid), articleId, startTimeSec, endTimeSec,
                    startCharOffset, endCharOffset, text,
                    audioChunkIndex, approximate (boolean)

audioFiles: key, blob (webm/opus)
```

Indexes: `audioChunks` by `[articleId+index]`; `transcriptSegments` by `[articleId+startCharOffset]`.

Rules:
- Editing text never deletes audio chunks or segments; it only shifts offsets / sets `approximate`.
- Deleting an article cascades to its chunks, segments, and blobs.

## 6. UI

Global constraints: system fonts only; no gradients, glassmorphism, or custom shadows; minimum 48px touch targets; full keyboard navigation; ARIA labels on all controls; visible focus states.

### 6.1 Home (article library)
- List of articles: title, last-updated date, duration. Plain semantic list.
- Primary action "New article" button at top of list.
- Per-article actions (rename, duplicate, delete, export) behind a menu button; delete requires confirmation dialog.

### 6.2 Recording screen
- Live transcript area: finalized text plain, current interim result visually subdued (reduced contrast, not color-only).
- Elapsed-time display (mm:ss) and Stop button.
- Mic permission requested on entry; denial shows inline explanation plus instructions to re-enable in browser settings.
- On stop: final transcript saved, chunks flushed, navigate to Editor.

### 6.3 Editor
- Desktop: transcript `<textarea>` filling main column; clips sidebar on the right listing chunks chronologically ("Clip 1 · 0:00–0:30", …).
- Mobile (<900px): clips panel collapses into a bottom sheet toggled by a persistent toggle button; highlighted clip auto-expands the panel when the cursor moves.
- Cursor tracking: `selectionStart` read on click/keyup/selection events → `findSegmentForCursor` → highlight that chunk and scroll it into view.
- Approximate mapping shown with an "~" badge on the highlighted clip row (plus ARIA text).
- Playback: one shared `<audio>` element; play/pause per row; minimal seek bar inside the playing row only.
- Autosave ~500 ms debounce; "Saved" indicator.

### 6.4 Unsupported browsers
Full-page notice: "Dictation requires Chrome or Edge" with explanation; no partial functionality offered.

## 7. Error handling

| Case | Behavior |
|---|---|
| Unsupported browser | Blocking notice screen |
| Mic permission denied | Inline explanation + settings instructions; retry button |
| Recognition error (`network`, `service-not-allowed`) | Non-blocking toast; auto-retry where recoverable |
| Recorder error mid-session | Keep already-saved chunks; toast with option to stop session safely |
| IndexedDB write failure | Toast; editor keeps working from memory; retried on next autosave tick |

## 8. Performance targets

- App interactive < 2 s on broadband.
- Interim results rendered without perceptible lag (React state updates batched per recognition event).
- Clip list virtualized if > 100 rows (render window).
- Playback starts within ~300 ms (single reused `<audio>` element).

## 9. Testing strategy

- **Unit (Vitest):**
  - `RecorderService` timing logic (30s boundaries via injected clock).
  - `MappingService`: chunk lookup across ranges/boundaries; fallback-to-preceding with `approximate`; diff adjustment for insert/delete/replace at various offsets; multi-segment shifts.
- **Component (React Testing Library):**
  - Sidebar highlight follows simulated cursor moves; approximate badge renders; mobile bottom panel opens/expands on highlight; menus and confirm dialogs work; keyboard access.
- **Integration (Playwright, Chromium):**
  - Mocked `SpeechRecognition` + mocked `MediaRecorder`: record → interim/final text appears → stop → edit text near segment boundary → cursor maps to expected clip → playback controls respond.
- **Manual:** Android Chrome on a physical device; long-session check (~30 min) for memory stability.

## 10. Acceptance criteria

1. In Chrome/Edge, user can record; words appear in real time as streaming transcription.
2. Audio is captured as standalone 30-second webm/opus chunks (final chunk may be shorter).
3. Transcript is editable plain text after recording; edits never remove audio.
4. Moving the cursor highlights the correct clip; unmapped regions fall back to nearest preceding clip marked approximate.
5. Tapping a clip plays exactly that 30 s portion with play/pause and within-clip seek.
6. Articles autosave, reopen, rename, duplicate, delete (with confirmation), and export/share as text + full recording.
7. Non-Chrome browsers see the unsupported notice.
8. All automated tests pass; layout works desktop and mobile widths.

## 11. Risks / known limitations

- Web Speech API quality/latency is Google-server-dependent and undocumented; interim cadence cannot be strictly guaranteed against the original sub-500 ms target (mobile-native spec). Accepted for MVP.
- Rollover gap at chunk boundaries (see §4.3).
- Blob concatenation for full-recording export produces a valid webm for Chrome-recorded streams; verified during implementation.
