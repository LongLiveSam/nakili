# Dictation Scribe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome-first web dictation app: streaming transcription while recording, editable plain-text transcripts, 30-second audio chunks, and cursor-position-to-chunk highlight for playback.

**Architecture:** React 18 SPA (no router — three views switched via a tiny app store). Pure logic lives in framework-agnostic services (`MappingService`, `SpeechService`, `RecorderService`, `ExportService`) so everything hard is unit-tested without a DOM or real microphone. Persistence is Dexie (IndexedDB); state is Zustand.

**Tech Stack:** Vite, React 18, TypeScript (strict), Zustand, Dexie, Vitest + Testing Library + jsdom, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-08-24-dictation-scribe-design.md`

## Global Constraints

- Target browsers: Chrome/Edge only; other browsers get a blocking notice (Task 8).
- No gradients, glassmorphism, or custom box-shadows anywhere in CSS.
- System font stack only: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Minimum interactive target: 48×48 px; keyboard reachable; visible `:focus-visible`; ARIA labels on all controls.
- Editor is plain text only (`<textarea>`).
- All data local-only (IndexedDB); no network calls except the speech API itself.
- Audio: whatever `MediaRecorder` produces in Chrome (webm/opus). Chunks exactly 30 s; final chunk may be shorter.
- Text edits never delete `audioChunks`, `audioFiles`, or `transcriptSegments` rows — only shift offsets / set `approximate`.
- Every task ends with `npm test` green and a git commit.
- Package manager: npm. Platform: Windows/PowerShell — chain commands with `;` not `&&`.

---

### Task 1: Scaffold project, Vitest, base styles

**Files:**
- Create: `package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles/global.css`, `src/test-setup.ts`
- Test: `src/smoke.test.tsx`

**Interfaces:**
- Produces: working Vite app; `npm test` script; global stylesheet with tokens `--bg --fg --fg-subtle --border --accent --accent-fg --danger --radius`.

- [ ] **Step 1: Scaffold Vite React-TS app**

```powershell
npm create vite@latest . -- --template react-ts; if ($?) { npm install }
```

Directory contains `docs/` and `.git/`; when Vite asks how to proceed choose "Ignore files and continue".

- [ ] **Step 2: Install dependencies**

```powershell
npm install zustand dexie; if ($?) { npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb }
```

- [ ] **Step 3: Configure Vitest**

Replace contents of `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: false,
  },
});
```

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

Set scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

Delete `src/App.css` and `src/index.css`.

- [ ] **Step 4: Base stylesheet**

Create `src/styles/global.css`:

```css
:root {
  --bg: #ffffff;
  --fg: #1f1f1f;
  --fg-subtle: #5f6368;
  --border: #dadce0;
  --accent: #0b57d0;
  --accent-fg: #ffffff;
  --danger: #b3261e;
  --radius: 4px;
}

* { box-sizing: border-box; }

html, body, #root { height: 100%; margin: 0; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}

button {
  font: inherit;
  min-height: 48px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
}
button:hover { background: #f8f9fa; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}
button.primary:hover { background: #0a4cb8; }

button.danger { color: var(--danger); }

input[type="text"], textarea {
  font: inherit;
  color: inherit;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px;
  background: var(--bg);
}
input[type="text"]:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
textarea { resize: none; }
```

Update `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Replace `src/App.tsx`:

```tsx
export default function App() {
  return <main>Dictation Scribe</main>;
}
```

- [ ] **Step 5: Write smoke test**

Create `src/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the app shell', () => {
    render(<App />);
    expect(screen.getByText('Dictation Scribe')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```powershell
git add -A; if ($?) { git commit -m "chore: scaffold Vite React-TS app with Vitest and base styles" }
```

---

### Task 2: Data model, Dexie schema, repositories

**Files:**
- Create: `src/core/models.ts`, `src/core/db/db.ts`, `src/core/db/repositories.ts`, `src/core/db/uuid.ts`
- Test: `src/core/db/repositories.test.ts`

**Interfaces:**
- Produces:
  - Types `Article`, `AudioChunk`, `TranscriptSegment` exactly as in `src/core/models.ts` below.
  - `db`: Dexie instance with tables `articles`, `audioChunks`, `transcriptSegments`, `audioFiles`.
  - Repository functions:
    - `listArticles(): Promise<Article[]>` (newest `updatedAt` first)
    - `getArticle(id: string): Promise<Article | undefined>`
    - `putArticle(a: Article): Promise<void>`
    - `deleteArticleCascade(id: string): Promise<void>`
    - `saveSessionAudio(articleId: string, blobs: Blob[], chunkSeconds?: number): Promise<string[]>`
    - `getAudioBlob(key: string): Promise<Blob | undefined>`
    - `putSegments(segs: TranscriptSegment[]): Promise<void>`
    - `getSegments(articleId: string): Promise<TranscriptSegment[]>`
    - `getChunks(articleId: string): Promise<AudioChunk[]>`

- [ ] **Step 1: Write models**

Create `src/core/models.ts`:

```ts
export interface Article {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  durationSec: number;
  transcriptText: string;
}

export interface AudioChunk {
  id: string;
  articleId: string;
  index: number;
  startTimeSec: number;
  endTimeSec: number;
  blobKey: string;
  durationSec: number;
}

export interface TranscriptSegment {
  id: string;
  articleId: string;
  startTimeSec: number;
  endTimeSec: number;
  startCharOffset: number;
  endCharOffset: number; // inclusive index of last character
  text: string;
  audioChunkIndex: number;
  approximate: boolean;
}
```

- [ ] **Step 2: Write failing repository tests**

Create `src/core/db/repositories.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
  listArticles, getArticle, putArticle, deleteArticleCascade,
  saveSessionAudio, getAudioBlob, putSegments, getSegments, getChunks,
} from './repositories';
import type { Article, TranscriptSegment } from '../models';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'a1', title: 'Draft', createdAt: 1, updatedAt: 1,
    durationSec: 0, transcriptText: '', ...overrides,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('articles', () => {
  it('round-trips and sorts newest first', async () => {
    await putArticle(makeArticle({ id: 'a1', updatedAt: 100 }));
    await putArticle(makeArticle({ id: 'a2', updatedAt: 200 }));
    const all = await listArticles();
    expect(all.map((a) => a.id)).toEqual(['a2', 'a1']);
    expect(await getArticle('a1')).toMatchObject({ title: 'Draft' });
  });

  it('cascade-deletes chunks, segments, and audio files', async () => {
    await putArticle(makeArticle());
    await saveSessionAudio('a1', [new Blob(['x'])]);
    await putSegments([{
      id: 's1', articleId: 'a1', startTimeSec: 0, endTimeSec: 2,
      startCharOffset: 0, endCharOffset: 4, text: 'hello',
      audioChunkIndex: 0, approximate: false,
    }]);
    await deleteArticleCascade('a1');
    expect((await db.articles.toArray()).length).toBe(0);
    expect((await getSegments('a1')).length).toBe(0);
    expect((await getChunks('a1')).length).toBe(0);
    expect((await db.audioFiles.toArray()).length).toBe(0);
  });
});

describe('audio', () => {
  it('stores ordered chunks with blob keys and returns blobs', async () => {
    await putArticle(makeArticle());
    const keys = await saveSessionAudio('a1', [new Blob(['aa']), new Blob(['bb'])]);
    expect(keys.length).toBe(2);
    const chunks = await getChunks('a1');
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    const blob = await getAudioBlob(keys[0]);
    expect(await blob!.text()).toBe('aa');
  });
});

describe('segments', () => {
  it('stores and fetches segments by article', async () => {
    const s: TranscriptSegment = {
      id: 's1', articleId: 'a1', startTimeSec: 0, endTimeSec: 1,
      startCharOffset: 0, endCharOffset: 2, text: 'hi',
      audioChunkIndex: 0, approximate: false,
    };
    await putSegments([s]);
    expect(await getSegments('a1')).toEqual([s]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./db` / `./repositories`

- [ ] **Step 4: Implement db and repositories**

Create `src/core/db/db.ts`:

```ts
import Dexie, { type Table } from 'dexie';
import type { Article, AudioChunk, TranscriptSegment } from '../models';

export interface AudioFileRow { key: string; blob: Blob }

export class ScribeDB extends Dexie {
  articles!: Table<Article, string>;
  audioChunks!: Table<AudioChunk, string>;
  transcriptSegments!: Table<TranscriptSegment, string>;
  audioFiles!: Table<AudioFileRow, string>;

  constructor(name = 'dictation-scribe') {
    super(name);
    this.version(1).stores({
      articles: 'id',
      audioChunks: 'id, [articleId+index]',
      transcriptSegments: 'id, [articleId+startCharOffset]',
      audioFiles: 'key',
    });
  }
}

export const db = new ScribeDB();
```

Create `src/core/db/uuid.ts`:

```ts
export const v4 = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
```

Create `src/core/db/repositories.ts`:

```ts
import { v4 as uuid } from './uuid';
import { db } from './db';
import type { Article, AudioChunk, TranscriptSegment } from '../models';

export async function listArticles(): Promise<Article[]> {
  const all = await db.articles.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getArticle(id: string) {
  return db.articles.get(id);
}

export function putArticle(a: Article) {
  return db.articles.put(a);
}

export async function deleteArticleCascade(id: string): Promise<void> {
  await db.transaction('rw', db.articles, db.audioChunks, db.transcriptSegments, db.audioFiles, async () => {
    const chunks = await getChunks(id);
    const keys = chunks.map((c) => c.blobKey);
    await db.audioChunks.where('articleId').equals(id).delete();
    await db.transcriptSegments.where('articleId').equals(id).delete();
    await db.articles.delete(id);
    await db.audioFiles.bulkDelete(keys);
  });
}

/** Stores chunk blobs in order; creates AudioChunk rows at nominal 30 s spacing. */
export async function saveSessionAudio(
  articleId: string,
  blobs: Blob[],
  chunkSeconds = 30,
): Promise<string[]> {
  const keys = blobs.map(() => uuid());
  const rows: AudioChunk[] = blobs.map((_, i) => ({
    id: uuid(),
    articleId,
    index: i,
    startTimeSec: i * chunkSeconds,
    endTimeSec: (i + 1) * chunkSeconds,
    blobKey: keys[i],
    durationSec: chunkSeconds,
  }));
  await db.transaction('rw', db.audioFiles, db.audioChunks, async () => {
    await db.audioFiles.bulkPut(rows.map((r, i) => ({ key: keys[i], blob: blobs[i] })));
    await db.audioChunks.bulkPut(rows);
  });
  return keys;
}

export async function getAudioBlob(key: string): Promise<Blob | undefined> {
  const row = await db.audioFiles.get(key);
  return row?.blob;
}

export function putSegments(segs: TranscriptSegment[]) {
  return db.transcriptSegments.bulkPut(segs);
}

export async function getSegments(articleId: string): Promise<TranscriptSegment[]> {
  const rows = await db.transcriptSegments.where('articleId').equals(articleId).toArray();
  return rows.sort((a, b) => a.startCharOffset - b.startCharOffset);
}

export async function getChunks(articleId: string): Promise<AudioChunk[]> {
  const rows = await db.audioChunks
    .where('[articleId+index]')
    .between([articleId, 0], [articleId, Infinity])
    .toArray();
  return rows.sort((a, b) => a.index - b.index);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (all)

- [ ] **Step 6: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: Dexie schema and repositories for articles, chunks, segments, audio" }
```

---

### Task 3: MappingService — edit ranges and chunk indexing

**Files:**
- Create: `src/core/services/MappingService.ts`
- Test: `src/core/services/mapping-editRange.test.ts`

**Interfaces:**
- Produces:
  - `CHUNK_SECONDS = 30`
  - `chunkIndexForElapsed(seconds: number): number`
  - `computeEditRange(oldText: string, newText: string): { start: number; oldEnd: number; newEnd: number }` — replaced region is `old[start..oldEnd)` → `new[start..newEnd)` (exclusive ends).

- [ ] **Step 1: Write failing tests**

Create `src/core/services/mapping-editRange.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeEditRange, chunkIndexForElapsed } from './MappingService';

describe('chunkIndexForElapsed', () => {
  it.each([
    [0, 0], [29.9, 0], [30, 1], [59.99, 1], [60, 2],
  ])('%fs -> chunk %i', (sec, expected) => {
    expect(chunkIndexForElapsed(sec)).toBe(expected);
  });
});

describe('computeEditRange', () => {
  it('detects pure insertion', () => {
    expect(computeEditRange('hello world', 'hello big world')).toEqual({
      start: 6, oldEnd: 6, newEnd: 10,
    });
  });

  it('detects pure deletion', () => {
    expect(computeEditRange('hello big world', 'hello world')).toEqual({
      start: 6, oldEnd: 10, newEnd: 6,
    });
  });

  it('detects replacement', () => {
    expect(computeEditRange('hello world', 'hello there')).toEqual({
      start: 6, oldEnd: 11, newEnd: 11,
    });
  });

  it('handles append at end', () => {
    expect(computeEditRange('abc', 'abcdef')).toEqual({ start: 3, oldEnd: 3, newEnd: 6 });
  });

  it('handles identical text', () => {
    expect(computeEditRange('same', 'same')).toEqual({ start: 4, oldEnd: 4, newEnd: 4 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/services/mapping-editRange.test.ts`
Expected: FAIL — module has no exports / not found

- [ ] **Step 3: Implement**

Create `src/core/services/MappingService.ts`:

```ts
export const CHUNK_SECONDS = 30;

export function chunkIndexForElapsed(seconds: number): number {
  return Math.floor(seconds / CHUNK_SECONDS);
}

/**
 * Character-level diff via longest common prefix/suffix.
 * Returns the replaced region: old[start..oldEnd) -> new[start..newEnd).
 */
export function computeEditRange(
  oldText: string,
  newText: string,
): { start: number; oldEnd: number; newEnd: number } {
  let start = 0;
  const maxPrefix = Math.min(oldText.length, newText.length);
  while (start < maxPrefix && oldText[start] === newText[start]) start++;

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, oldEnd, newEnd };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/core/services/mapping-editRange.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: computeEditRange diff and 30s chunk indexing" }
```

---

### Task 4: MappingService — segment adjustment and transcript building

**Files:**
- Modify: `src/core/services/MappingService.ts`
- Test: `src/core/services/mapping-adjust.test.ts`

**Interfaces:**
- Consumes: `computeEditRange`, `CHUNK_SECONDS` (Task 3); `TranscriptSegment` (Task 2).
- Produces:
  - `interface FinalResult { text: string; startTimeSec: number; endTimeSec: number }`
  - `adjustSegmentsAfterEdit(segments: TranscriptSegment[], oldText: string, newText: string): TranscriptSegment[]` — never deletes segments; shifts offsets past the edit by `delta`; overlapping segments become clamped + `approximate: true`.
  - `buildTranscript(finals: FinalResult[]): { text: string; segments: Omit<TranscriptSegment, 'id' | 'articleId'>[] }` — joins finals with `' '`; offsets computed over joined text; `audioChunkIndex = chunkIndexForElapsed(startTimeSec)`.

- [ ] **Step 1: Write failing tests**

Create `src/core/services/mapping-adjust.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { adjustSegmentsAfterEdit, buildTranscript, type FinalResult } from './MappingService';
import type { TranscriptSegment } from '../models';

function seg(partial: Partial<TranscriptSegment>): TranscriptSegment {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    articleId: 'a1',
    startTimeSec: 0, endTimeSec: 1,
    startCharOffset: 0, endCharOffset: 0,
    text: 'x', audioChunkIndex: 0, approximate: false,
    ...partial,
  };
}

// Text: "alpha bravo charlie"
//        0-4    6-10   12-18   (inclusive char offsets)
const BASE_SEGS = [
  seg({ id: 'segA', text: 'alpha', startCharOffset: 0, endCharOffset: 4 }),
  seg({ id: 'segB', text: 'bravo', startCharOffset: 6, endCharOffset: 10 }),
  seg({ id: 'segC', text: 'charlie', startCharOffset: 12, endCharOffset: 18 }),
];
const BASE_TEXT = 'alpha bravo charlie';

describe('adjustSegmentsAfterEdit', () => {
  it('returns same array when text unchanged', () => {
    expect(adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, BASE_TEXT)).toBe(BASE_SEGS);
  });

  it('shifts later segments after an insertion before them', () => {
    const newText = 'alpha XX bravo charlie'; // inserted "XX " at offset 6
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.find((s) => s.id === 'segB')).toMatchObject({
      startCharOffset: 9, endCharOffset: 13, approximate: false,
    });
    expect(out.find((s) => s.id === 'segC')).toMatchObject({
      startCharOffset: 15, endCharOffset: 21, approximate: false,
    });
  });

  it('marks a deleted segment approximate and collapses it at the edit point', () => {
    // "bravo" removed entirely -> "alpha  charlie"
    const newText = 'alpha  charlie';
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.find((s) => s.id === 'segA')).toMatchObject({ startCharOffset: 0, endCharOffset: 4, approximate: false });
    const b = out.find((s) => s.id === 'segB')!;
    expect(b.approximate).toBe(true);
    expect(b.endCharOffset).toBeLessThan(b.startCharOffset + 1); // collapsed to <= zero-width
    expect(out.find((s) => s.id === 'segC')).toMatchObject({ startCharOffset: 7, endCharOffset: 13, approximate: false });
  });

  it('keeps a segment mapped-but-approximate when inserting inside it', () => {
    // insert inside "bravo": "alpha braXvo charlie"
    const newText = 'alpha braXvo charlie';
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.find((s) => s.id === 'segB')).toMatchObject({ approximate: true });
    expect(out.find((s) => s.id === 'segB')!.endCharOffset).toBeGreaterThan(10); // expanded
    expect(out.find((s) => s.id === 'segC')).toMatchObject({ startCharOffset: 13, endCharOffset: 19, approximate: false });
  });

  it('never deletes segments even when all their text is replaced', () => {
    const out = adjustSegmentsAfterEdit([BASE_SEGS[0]], 'alpha', 'zzz');
    expect(out.length).toBe(1);
    expect(out[0].approximate).toBe(true);
  });

  it('handles deletion spanning the end of one segment into a gap', () => {
    // delete "o br" (offsets 9..13 exclusive end) -> "alpha bavo charlie"? 
    // Simpler: delete chars 8..13 ("vo ch") -> "alpha brarlie"
    const newText = 'alpha brarlie';
    const out = adjustSegmentsAfterEdit(BASE_SEGS, BASE_TEXT, newText);
    expect(out.length).toBe(3);
    expect(out.find((s) => s.id === 'segB')!.approximate).toBe(true);
    expect(out.find((s) => s.id === 'segC')!.approximate).toBe(true);
  });
});

describe('buildTranscript', () => {
  it('joins finals with spaces and assigns offsets and chunk indexes', () => {
    const finals: FinalResult[] = [
      { text: 'Hello world', startTimeSec: 1, endTimeSec: 3 },
      { text: 'second part', startTimeSec: 31, endTimeSec: 34 },
    ];
    const { text, segments } = buildTranscript(finals);
    expect(text).toBe('Hello world second part');
    expect(segments[0]).toMatchObject({
      startCharOffset: 0, endCharOffset: 10, audioChunkIndex: 0,
      startTimeSec: 1, endTimeSec: 3, approximate: false,
    });
    expect(segments[1]).toMatchObject({
      startCharOffset: 12, endCharOffset: 22, audioChunkIndex: 1,
      startTimeSec: 31, endTimeSec: 34, approximate: false,
    });
  });

  it('returns empty for no finals', () => {
    expect(buildTranscript([])).toEqual({ text: '', segments: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/services/mapping-adjust.test.ts`
Expected: FAIL — exports missing

- [ ] **Step 3: Implement**

Append to `src/core/services/MappingService.ts`:

```ts
import type { TranscriptSegment } from '../models';

export interface FinalResult {
  text: string;
  startTimeSec: number;
  endTimeSec: number;
}

export function adjustSegmentsAfterEdit(
  segments: TranscriptSegment[],
  oldText: string,
  newText: string,
): TranscriptSegment[] {
  if (oldText === newText) return segments;

  const { start, oldEnd, newEnd } = computeEditRange(oldText, newText);
  const delta = newText.length - oldText.length;

  return segments.map((s): TranscriptSegment => {
    // Entirely before the edited region -> untouched.
    if (s.endCharOffset < start) return s;
    // Entirely after -> shift by delta.
    if (s.startCharOffset >= oldEnd) {
      return {
        ...s,
        startCharOffset: s.startCharOffset + delta,
        endCharOffset: s.endCharOffset + delta,
      };
    }

    // Segment overlaps the edited region [start, oldEnd).
    if (s.startCharOffset >= start && s.endCharOffset < oldEnd) {
      // Fully inside: no surviving mapped text; collapse to zero-width at the
      // edit seam's position in NEW-text coordinates (newEnd, NOT start+delta —
      // they differ whenever trailing text shrank/grew by more than the seam).
      return { ...s, startCharOffset: newEnd, endCharOffset: newEnd - 1, approximate: true };
    }
    if (s.startCharOffset < start && s.endCharOffset >= oldEnd) {
      // Spanning the whole edit: expand, keep mapping, mark approximate.
      return { ...s, endCharOffset: s.endCharOffset + delta, approximate: true };
    }
    if (s.startCharOffset < start) {
      // Ends inside the edit: keep surviving prefix only.
      return { ...s, endCharOffset: start - 1, approximate: true };
    }
    // Starts inside the edit: keep surviving suffix only (seam = newEnd).
    return {
      ...s,
      startCharOffset: newEnd,
      endCharOffset: s.endCharOffset + delta,
      approximate: true,
    };
  });
}

export function buildTranscript(finals: FinalResult[]): {
  text: string;
  segments: Omit<TranscriptSegment, 'id' | 'articleId'>[];
} {
  let text = '';
  const segments: Omit<TranscriptSegment, 'id' | 'articleId'>[] = [];
  for (const f of finals) {
    if (text.length > 0) text += ' ';
    const wordStart = text.length;
    text += f.text;
    segments.push({
      startTimeSec: f.startTimeSec,
      endTimeSec: f.endTimeSec,
      startCharOffset: wordStart,
      endCharOffset: wordStart + f.text.length - 1,
      text: f.text,
      audioChunkIndex: chunkIndexForElapsed(f.startTimeSec),
      approximate: false,
    });
  }
  return { text, segments };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS. If the "deletion spanning" case fails, verify the branch order matches the implementation above exactly (before / after / fully-inside / spanning / ends-inside / starts-inside) — that order is load-bearing.

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: edit-aware segment adjustment and transcript building" }
```

---

### Task 5: MappingService — cursor lookup

**Files:**
- Modify: `src/core/services/MappingService.ts`
- Test: `src/core/services/mapping-cursor.test.ts`

**Interfaces:**
- Consumes: `TranscriptSegment`.
- Produces:
  - `interface CursorMapping { segment: TranscriptSegment | null; approximate: boolean }`
  - `findSegmentForCursor(segments: TranscriptSegment[], cursorOffset: number): CursorMapping`
    - Exact hit (`start <= cursor <= end` and not zero-width-only match): returns segment with its own `approximate` flag.
    - Gap/before-all/collapsed cases: nearest preceding segment with `approximate: true`; before all → first non-collapsed segment, `approximate: true`; none → `{ segment: null, approximate: true }`.

- [ ] **Step 1: Write failing tests**

Create `src/core/services/mapping-cursor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findSegmentForCursor } from './MappingService';
import type { TranscriptSegment } from '../models';

function seg(id: string, start: number, end: number, approx = false): TranscriptSegment {
  return {
    id, articleId: 'a1', startTimeSec: 0, endTimeSec: 1,
    startCharOffset: start, endCharOffset: end, text: 'x',
    audioChunkIndex: 0, approximate: approx,
  };
}

// "alpha bravo charlie"
const SEGS = [seg('s0', 0, 4), seg('s1', 6, 10), seg('s2', 12, 18)];

describe('findSegmentForCursor', () => {
  it('maps cursor inside a segment exactly', () => {
    const r = findSegmentForCursor(SEGS, 2);
    expect(r.segment!.id).toBe('s0');
    expect(r.approximate).toBe(false);
  });

  it('matches boundaries inclusively', () => {
    expect(findSegmentForCursor(SEGS, 4).segment!.id).toBe('s0');
    expect(findSegmentForCursor(SEGS, 6).segment!.id).toBe('s1');
    expect(findSegmentForCursor(SEGS, 18).segment!.id).toBe('s2');
  });

  it('falls back to nearest preceding in gaps, marked approximate', () => {
    const r = findSegmentForCursor(SEGS, 5);
    expect(r.segment!.id).toBe('s0');
    expect(r.approximate).toBe(true);
  });

  it('propagates approximate flag of matched segment', () => {
    const r = findSegmentForCursor([seg('a', 0, 4, true)], 2);
    expect(r.approximate).toBe(true);
  });

  it('falls forward when cursor precedes all segments', () => {
    const r = findSegmentForCursor([seg('z', 10, 20)], 0);
    expect(r.segment!.id).toBe('z');
    expect(r.approximate).toBe(true);
  });

  it('skips collapsed segments in search', () => {
    const collapsed = [seg('a', 0, 4), seg('c', 5, 4), seg('b', 6, 10)];
    const r = findSegmentForCursor(collapsed, 5);
    expect(r.segment!.id).toBe('a');
    expect(r.approximate).toBe(true);
  });

  it('returns null mapping with no segments', () => {
    expect(findSegmentForCursor([], 0)).toEqual({ segment: null, approximate: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/services/mapping-cursor.test.ts`
Expected: FAIL — export missing

- [ ] **Step 3: Implement**

Append to `src/core/services/MappingService.ts`:

```ts
export interface CursorMapping {
  segment: TranscriptSegment | null;
  approximate: boolean;
}

export function findSegmentForCursor(
  segments: TranscriptSegment[],
  cursorOffset: number,
): CursorMapping {
  if (segments.length === 0) return { segment: null, approximate: true };

  const sorted = [...segments].sort((a, b) => a.startCharOffset - b.startCharOffset);

  // Binary search: rightmost segment whose start is <= cursor.
  let lo = 0;
  let hi = sorted.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].startCharOffset <= cursorOffset) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (candidate === -1) {
    // Cursor precedes everything: fall forward to first non-collapsed segment.
    const first = sorted.find((s) => s.endCharOffset >= s.startCharOffset) ?? null;
    return { segment: first, approximate: true };
  }

  // Walk back past any collapsed (zero/negative-width) segments.
  let s = sorted[candidate];
  while (s.endCharOffset < s.startCharOffset && candidate > 0) {
    candidate--;
    s = sorted[candidate];
  }
  if (s.endCharOffset < s.startCharOffset) {
    const first = sorted.find((x) => x.endCharOffset >= x.startCharOffset) ?? null;
    return { segment: first, approximate: true };
  }

  if (cursorOffset <= s.endCharOffset) {
    return { segment: s, approximate: s.approximate };
  }
  // Cursor sits after `s`'s end (gap): approximate fallback.
  return { segment: s, approximate: true };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: cursor-offset to segment lookup with approximate fallback" }
```

---

### Task 6: SpeechService (Web Speech API wrapper)

**Files:**
- Create: `src/core/services/SpeechService.ts`
- Test: `src/core/services/SpeechService.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface RecognitionEventLike {
    resultIndex: number;
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  }
  interface RecognitionLike {
    lang: string; continuous: boolean; interimResults: boolean;
    start(): void; stop(): void; abort(): void;
    onresult: ((e: RecognitionEventLike) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
  }
  class SpeechService {
    static isSupported(): boolean;
    constructor(opts?: { createRecognition?: () => RecognitionLike; now?: () => number });
    onInterim: ((text: string) => void) | null;
    onFinal: ((text: string, elapsedSec: number) => void) | null;
    onError: ((err: string, fatal: boolean) => void) | null;
    stopRequested: boolean;
    start(): void;  // throws Error('unsupported') when construction/start fails
    stop(): void;
  }
  ```
  Behavior: continuous + interim on; final results emit elapsed seconds via injected `now` (default `performance.now()/1000`); recoverable errors (`no-speech`, `network`, `audio-capture`, `aborted`) restart recognition unless `stopRequested`; fatal errors surface once via `onError(err, true)`.

- [ ] **Step 1: Write failing tests**

Create `src/core/services/SpeechService.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { SpeechService, type RecognitionLike, type RecognitionEventLike } from './SpeechService';

function makeFakeRecognition() {
  const rec: RecognitionLike = {
    lang: '', continuous: false, interimResults: false,
    start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    onresult: null, onerror: null, onend: null,
  };
  return rec;
}

function resultEvent(items: Array<{ text: string; isFinal: boolean }>): RecognitionEventLike {
  const results = items.map((i) => Object.assign([{ transcript: i.text }], { isFinal: i.isFinal }));
  return { resultIndex: 0, results: results as never };
}

let clock = 1000;

describe('SpeechService', () => {
  it('emits interim and final results with elapsed time', () => {
    const rec = makeFakeRecognition();
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    const interims: string[] = [];
    const finals: Array<[string, number]> = [];
    svc.onInterim = (t) => interims.push(t);
    svc.onFinal = (t, e) => finals.push([t, e]);

    svc.start();
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(rec.start).toHaveBeenCalledTimes(1);

    rec.onresult!(resultEvent([{ text: 'hel', isFinal: false }]));
    expect(interims).toEqual(['hel']);

    clock = 1002.5;
    rec.onresult!(resultEvent([{ text: 'hello', isFinal: true }]));
    expect(finals).toEqual([['hello', 2.5]]);
  });

  it('restarts after recoverable errors unless stopped', () => {
    const rec = makeFakeRecognition();
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    svc.start();
    (rec.start as ReturnType<typeof vi.fn>).mockClear();

    rec.onerror!({ error: 'no-speech' });
    expect(rec.start).toHaveBeenCalledTimes(1);

    svc.stop();
    expect(svc.stopRequested).toBe(true);
    rec.onerror!({ error: 'network' });
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it('reports fatal errors without restarting', () => {
    const rec = makeFakeRecognition();
    const errors: Array<[string, boolean]> = [];
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    svc.onError = (e, fatal) => errors.push([e, fatal]);
    svc.start();
    rec.onerror!({ error: 'not-allowed' });
    expect(errors).toEqual([['not-allowed', true]]);
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it('throws on unsupported environment', () => {
    const svc = new SpeechService({
      createRecognition: () => { throw new Error('unsupported'); },
      now: () => clock,
    });
    expect(() => svc.start()).toThrow(/unsupported/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/services/SpeechService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/core/services/SpeechService.ts`:

```ts
export interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const RECOVERABLE = new Set(['no-speech', 'network', 'audio-capture', 'aborted']);

type RecognitionCtor = new () => RecognitionLike;

function defaultCreateRecognition(): RecognitionLike {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) throw new Error('unsupported');
  const rec = new Ctor();
  rec.lang = navigator.language || 'en-US';
  return rec;
}

export class SpeechService {
  static isSupported(): boolean {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
  }

  onInterim: ((text: string) => void) | null = null;
  onFinal: ((text: string, elapsedSec: number) => void) | null = null;
  onError: ((err: string, fatal: boolean) => void) | null = null;

  private recognition: RecognitionLike;
  private now: () => number;
  private startedAt = 0;
  stopRequested = false;

  constructor(opts: { createRecognition?: () => RecognitionLike; now?: () => number } = {}) {
    this.now = opts.now ?? (() => performance.now() / 1000);
    this.recognition = (opts.createRecognition ?? defaultCreateRecognition)();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = (e) => this.handleResult(e);
    this.recognition.onerror = (e) => this.handleError(e.error);
  }

  start(): void {
    this.stopRequested = false;
    try {
      this.recognition.start();
    } catch {
      throw new Error('unsupported');
    }
    this.startedAt = this.now();
  }

  stop(): void {
    this.stopRequested = true;
    this.recognition.stop();
  }

  private handleResult(e: RecognitionEventLike): void {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0]?.transcript.trim();
      if (!text) continue;
      if (result.isFinal) {
        this.onFinal?.(text, this.now() - this.startedAt);
      } else {
        this.onInterim?.(text);
      }
    }
  }

  private handleError(error: string): void {
    if (!RECOVERABLE.has(error)) {
      this.onError?.(error, true);
      return;
    }
    if (this.stopRequested) return;
    try {
      this.recognition.start();
    } catch {
      this.onError?.(error, true);
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/core/services/SpeechService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: SpeechService wrapper around Web Speech API with error recovery" }
```

---

### Task 7: RecorderService (MediaRecorder with exact 30 s rollover)

**Files:**
- Create: `src/core/services/RecorderService.ts`
- Test: `src/core/services/RecorderService.test.ts`

**Interfaces:**
- Consumes: `CHUNK_SECONDS` (Task 3).
- Produces:
  ```ts
  interface MediaRecorderLike {
    start(): void; stop(): void; state: 'inactive' | 'recording';
    ondataavailable: ((e: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
  }
  interface RecordedChunk { index: number; blob: Blob; startTimeSec: number; durationSec: number }
  class RecorderService {
    constructor(deps?: {
      getUserMedia?: () => Promise<MediaStream>;
      createRecorder?: (stream: MediaStream) => MediaRecorderLike;
      setInterval?: typeof setInterval;
      clearInterval?: typeof clearInterval;
    });
    requestMicrophone(): Promise<void>;  // acquires stream up-front; throws on denial
    start(): void;                       // throws Error(/microphone/) if stream not acquired
    stop(): Promise<RecordedChunk[]>;    // [] when never started; else chunks in index order
    releaseStream(): void;
  }
  ```
  Rollover: interval fires every `CHUNK_SECONDS * 1000` ms; on fire, current recorder `.stop()` flushes its blob (`ondataavailable` fires synchronously-before `onstop` per spec), then a fresh recorder starts on the same stream. `startTimeSec = index * CHUNK_SECONDS` (nominal); `durationSec` measured wall-clock.

- [ ] **Step 1: Write failing tests**

Create `src/core/services/RecorderService.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { RecorderService, type MediaRecorderLike } from './RecorderService';

let blobSeq = 0;

function makeFakeRecorder() {
  const rec: MediaRecorderLike = {
    state: 'inactive',
    start: vi.fn(() => { rec.state = 'recording'; }),
    stop: vi.fn(() => {
      rec.state = 'inactive';
      queueMicrotask(() => {
        rec.ondataavailable?.({ data: new Blob([`blob${++blobSeq}`]) });
        rec.onstop?.();
      });
    }),
    ondataavailable: null,
    onstop: null,
  };
  return rec;
}

/** Interval callbacks registered but only fired manually by tickAll(). */
function makeManualTimers() {
  const callbacks = new Map<number, () => void>();
  let nextId = 1;
  const setInterval = ((cb: () => void) => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id as unknown as ReturnType<typeof setInterval>;
  }) as unknown as typeof setInterval;
  const clearInterval = ((id: number) => {
    callbacks.delete(id as number);
  }) as typeof clearInterval;
  return { setInterval, clearInterval, tickAll: () => [...callbacks.values()].forEach((cb) => cb()) };
}

async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('RecorderService', () => {
  it('rolls over to a fresh recorder each interval and yields ordered chunks', async () => {
    blobSeq = 0;
    const timers = makeManualTimers();
    const created: MediaRecorderLike[] = [];
    const svc = new RecorderService({
      getUserMedia: async () => ({}) as MediaStream,
      createRecorder: () => { const r = makeFakeRecorder(); created.push(r); return r; },
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    });
    await svc.requestMicrophone();
    svc.start();
    expect(created.length).toBe(1);

    timers.tickAll(); // one 30 s boundary elapses
    await flush();
    expect(created.length).toBe(2);
    expect(created[0].state).toBe('inactive');
    expect(created[1].state).toBe('recording');

    const chunks = await svc.stop();
    await flush();
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    expect(chunks.map((c) => c.startTimeSec)).toEqual([0, 30]);
    expect(chunks[0].blob.size).toBeGreaterThan(0);
    expect(chunks[1].blob.size).toBeGreaterThan(0);
  });

  it('clears its timer on stop so no further rollovers occur', async () => {
    blobSeq = 0;
    const timers = makeManualTimers();
    const svc = new RecorderService({
      getUserMedia: async () => ({}) as MediaStream,
      createRecorder: () => makeFakeRecorder(),
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    });
    await svc.requestMicrophone();
    svc.start();
    await svc.stop();
    const count = [...timers['callbacks' as never] as unknown as Map<number, () => void>].length;
    expect(count).toBe(0);
  });

  it('stop without start resolves empty', async () => {
    const svc = new RecorderService({});
    expect(await svc.stop()).toEqual([]);
  });

  it('start without microphone throws actionable error', () => {
    const svc = new RecorderService({});
    expect(() => svc.start()).toThrow(/microphone/i);
  });
});
```

Note on Step "clears its timer" test: accessing `timers['callbacks' as never]` is awkward TypeScript; instead expose `tickAll` count — simpler variant: after `stop()`, call `timers.tickAll()` and assert no new recorder was created. Replace that test body with:

```ts
it('does not roll over after stop', async () => {
  blobSeq = 0;
  const timers = makeManualTimers();
  const created: MediaRecorderLike[] = [];
  const svc = new RecorderService({
    getUserMedia: async () => ({}) as MediaStream,
    createRecorder: () => { const r = makeFakeRecorder(); created.push(r); return r; },
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
  });
  await svc.requestMicrophone();
  svc.start();
  await svc.stop();
  const countBefore = created.length;
  timers.tickAll();
  await flush();
  expect(created.length).toBe(countBefore);
});
```

Ship this second variant instead of the first "clears its timer" test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/services/RecorderService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/core/services/RecorderService.ts`:

```ts
import { CHUNK_SECONDS } from './MappingService';

export interface MediaRecorderLike {
  start(): void;
  stop(): void;
  state: 'inactive' | 'recording';
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

export interface RecordedChunk {
  index: number;
  blob: Blob;
  startTimeSec: number;
  durationSec: number;
}

interface RecorderDeps {
  getUserMedia?: () => Promise<MediaStream>;
  createRecorder?: (stream: MediaStream) => MediaRecorderLike;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
}

export class RecorderService {
  private getUserMedia: () => Promise<MediaStream>;
  private createRecorder: (stream: MediaStream) => MediaRecorderLike;
  private setIntervalFn: typeof setInterval;
  private clearIntervalFn: typeof clearInterval;

  private stream: MediaStream | null = null;
  private recorder: MediaRecorderLike | null = null;
  private chunks: RecordedChunk[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(deps: RecorderDeps = {}) {
    this.getUserMedia =
      deps.getUserMedia ??
      (() => navigator.mediaDevices.getUserMedia({ audio: true }));
    this.createRecorder =
      deps.createRecorder ??
      ((stream) => new MediaRecorder(stream) as unknown as MediaRecorderLike);
    this.setIntervalFn = deps.setInterval ?? setInterval.bind(globalThis);
    this.clearIntervalFn = deps.clearInterval ?? clearInterval.bind(globalThis);
  }

  async requestMicrophone(): Promise<void> {
    this.stream = await this.getUserMedia();
  }

  start(): void {
    if (!this.stream) throw new Error('microphone not acquired: call requestMicrophone() first');
    this.chunks = [];
    this.running = true;
    this.beginChunk(0);
    this.timerId = this.setIntervalFn(() => this.rollOver(), CHUNK_SECONDS * 1000);
  }

  async stop(): Promise<RecordedChunk[]> {
    if (!this.running) return [];
    this.running = false;
    if (this.timerId !== null) {
      this.clearIntervalFn(this.timerId);
      this.timerId = null;
    }
    await this.finishCurrentChunk();
    this.recorder = null;
    return [...this.chunks];
  }

  releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private beginChunk(index: number): void {
    this.recorder = this.createRecorder(this.stream!);
    const startedAtMs = Date.now();
    this.recorder.ondataavailable = (e) => {
      this.chunks.push({
        index,
        blob: e.data,
        startTimeSec: index * CHUNK_SECONDS,
        durationSec: (Date.now() - startedAtMs) / 1000,
      });
    };
    this.recorder.start();
  }

  /**
   * Rollover: the flushing chunk pushes itself via ondataavailable during
   * .stop() (fires synchronously before onstop), occupying slot `chunks.length`
   * at call time. The next chunk therefore begins at chunks.length (post-flush)
   * which equals pre-flush length + 1.
   */
  private rollOver(): void {
    if (!this.running || !this.recorder) return;
    const current = this.recorder;
    const nextIndex = this.chunks.length + 1;
    current.onstop = () => {
      current.onstop = null;
      if (this.running) this.beginChunk(nextIndex);
    };
    current.stop();
  }

  private finishCurrentChunk(): Promise<void> {
    const current = this.recorder;
    if (!current || current.state === 'inactive') return Promise.resolve();
    return new Promise<void>((resolve) => {
      const prevOnStop = current.onstop;
      current.onstop = () => {
        prevOnStop?.();
        resolve();
      };
      current.stop();
    });
  }
}
```

If the rollover-index test fails, debug the `nextIndex` arithmetic against the fake's event ordering rather than weakening assertions.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/core/services/RecorderService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: RecorderService with exact 30s rollover into standalone blobs" }
```

---

### Task 8: App shell, view switching, unsupported-browser notice, toasts

**Files:**
- Create: `src/ui/appStore.ts`, `src/ui/toastStore.ts`, `src/ui/Toast.tsx`, `src/ui/speechSupport.ts`, `src/ui/UnsupportedBrowserNotice.tsx`, `src/features/views.css`
- Modify: `src/App.tsx`
- Create placeholders: `src/features/library/LibraryView.tsx`, `src/features/recording/RecordingView.tsx`, `src/features/editor/EditorView.tsx`
- Test: `src/ui/appShell.test.tsx`

**Interfaces:**
- Produces:
  - `useAppStore`: `{ view: 'home' | 'record' | 'editor'; activeArticleId: string | null; navigate(view: View, articleId?: string | null): void }`
  - `useToastStore`: `{ toasts: { id: number; message: string }[]; showToast(message: string): void; dismiss(id: number): void }` — auto-dismiss after 4 s.
  - `<ToastHost />` — renders each toast in a `role="status"` region.
  - `speechSupported: boolean` module constant.
  - `<UnsupportedBrowserNotice />` — full-page blocking notice mentioning Chrome/Edge.

- [ ] **Step 1: Write failing test**

Create `src/ui/appShell.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';
import { useToastStore } from './toastStore';
import { useAppStore } from './appStore';

describe('app shell', () => {
  beforeEach(() => {
    useAppStore.setState({ view: 'home', activeArticleId: null });
    useToastStore.setState({ toasts: [] });
  });

  it('shows home view by default', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Articles' })).toBeInTheDocument();
  });

  it('shows unsupported-browser notice when Web Speech API is missing', async () => {
    vi.resetModules();
    vi.doMock('./speechSupport', () => ({ speechSupported: false }));
    const { default: AppReloaded } = await import('../App');
    render(<AppReloaded />);
    expect(screen.getByText(/requires Chrome or Edge/i)).toBeInTheDocument();
    vi.doUnmock('./speechSupport');
  });

  it('renders and auto-dismisses toasts after 4 s', async () => {
    vi.useFakeTimers();
    render(<App />);
    useToastStore.getState().showToast('Saved');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Saved');
    vi.advanceTimersByTime(4100);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    vi.useRealTimers();
  });

  it('navigates to record view on New article (placeholder creates id)', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /new article/i }));
    expect(useAppStore.getState().view).toBe('record');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/appShell.test.tsx`
Expected: FAIL — modules missing

- [ ] **Step 3: Implement stores and components**

Create `src/ui/appStore.ts`:

```ts
import { create } from 'zustand';

export type View = 'home' | 'record' | 'editor';

interface AppState {
  view: View;
  activeArticleId: string | null;
  navigate: (view: View, articleId?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'home',
  activeArticleId: null,
  navigate: (view, articleId = null) => set({ view, activeArticleId: articleId }),
}));
```

Create `src/ui/toastStore.ts`:

```ts
import { create } from 'zustand';

export interface Toast { id: number; message: string }

interface ToastState {
  toasts: Toast[];
  showToast: (message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
```

Create `src/ui/Toast.tsx`:

```tsx
import { useToastStore } from './toastStore';

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="toast">{t.message}</div>
      ))}
    </div>
  );
}
```

Create `src/ui/speechSupport.ts`:

```ts
export const speechSupported: boolean =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
```

Create `src/ui/UnsupportedBrowserNotice.tsx`:

```tsx
export function UnsupportedBrowserNotice() {
  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}>
      <h1>Dictation requires Chrome or Edge</h1>
      <p>
        This app uses the Web Speech API for live transcription, which is currently
        supported in Google Chrome and Microsoft Edge. Please open this page in one
        of those browsers.
      </p>
    </main>
  );
}
```

Create `src/features/views.css`:

```css
.view { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
.view-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; margin-bottom: 24px;
}
```

Add to `src/styles/global.css`:

```css
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
}
.toast {
  background: var(--fg);
  color: var(--bg);
  padding: 12px 20px;
  border-radius: var(--radius);
}
```

Replace `src/App.tsx`:

```tsx
import { useAppStore } from './ui/appStore';
import { ToastHost } from './ui/Toast';
import { UnsupportedBrowserNotice } from './ui/UnsupportedBrowserNotice';
import { speechSupported } from './ui/speechSupport';
import LibraryView from './features/library/LibraryView';
import RecordingView from './features/recording/RecordingView';
import EditorView from './features/editor/EditorView';
import './features/views.css';

export default function App() {
  const view = useAppStore((s) => s.view);

  if (!speechSupported) {
    return (
      <>
        <UnsupportedBrowserNotice />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      {view === 'home' && <LibraryView />}
      {view === 'record' && <RecordingView />}
      {view === 'editor' && <EditorView />}
      <ToastHost />
    </>
  );
}
```

Create placeholder views so the app compiles (each replaced by its own task):

`src/features/library/LibraryView.tsx`:

```tsx
import { useAppStore } from '../../ui/appStore';

export default function LibraryView() {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <main className="view">
      <div className="view-header">
        <h1>Articles</h1>
        <button className="primary" onClick={() => navigate('record')}>New article</button>
      </div>
    </main>
  );
}
```

`src/features/recording/RecordingView.tsx`:

```tsx
export default function RecordingView() {
  return <main className="view"><h1>Record</h1></main>;
}
```

`src/features/editor/EditorView.tsx`:

```tsx
export default function EditorView() {
  return <main className="view"><h1>Editor</h1></main>;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: app shell with view switching, unsupported notice, toasts" }
```

---

### Task 9: Library view — list, create, rename, duplicate, delete

**Files:**
- Create: `src/features/library/libraryStore.ts`, `src/features/library/ConfirmDialog.tsx`
- Modify: `src/features/library/LibraryView.tsx` (replace)
- Test: `src/features/library/library.test.tsx`

**Interfaces:**
- Consumes: repositories (Task 2), `useAppStore.navigate` (Task 8).
- Produces:
  - `useLibraryStore`: `{ articles: Article[]; loaded: boolean; refresh(): Promise<void>; createArticle(): Promise<string>; renameArticle(id: string, title: string): Promise<void>; duplicateArticle(id: string): Promise<string>; deleteArticle(id: string): Promise<void> }`
  - `formatDuration(totalSec: number): string` → `"m:ss"`.
  - `ConfirmDialog`: props `{ open: boolean; title: string; children?: ReactNode; confirmLabel: string; danger?: boolean; onConfirm(): void; onCancel(): void }` built on native `<dialog>`.

- [ ] **Step 1: Write failing tests**

Create `src/features/library/library.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import LibraryView from './LibraryView';
import { useLibraryStore } from './libraryStore';
import { db } from '../../core/db/db';
import { putArticle } from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useLibraryStore.setState({ articles: [], loaded: false });
  useAppStore.setState({ view: 'home', activeArticleId: null });
});

async function seed(title: string) {
  await putArticle({
    id: `id-${title}`, title, createdAt: 0,
    updatedAt: Date.parse('2026-01-02T10:00:00'), durationSec: 125, transcriptText: '',
  });
}

describe('library', () => {
  it('lists articles with date and duration', async () => {
    await seed('My essay');
    render(<LibraryView />);
    expect(await screen.findByText('My essay')).toBeInTheDocument();
    expect(screen.getByText(/2:05/)).toBeInTheDocument();
  });

  it('creates an article and navigates to record view with its id', async () => {
    render(<LibraryView />);
    await userEvent.click(screen.getByRole('button', { name: /new article/i }));
    await waitFor(() => expect(useAppStore.getState().view).toBe('record'));
    expect(useAppStore.getState().activeArticleId).toBeTruthy();
  });

  it('renames via dialog', async () => {
    await seed('Old name');
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Old name/i }));
    await userEvent.click(screen.getByRole('button', { name: /^rename$/i }));
    const input = screen.getByLabelText(/title/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'New name');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('New name')).toBeInTheDocument();
  });

  it('deletes only after confirmation', async () => {
    await seed('Doomed');
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Doomed/i }));
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    // Confirmation dialog appears before actual deletion:
    expect(useLibraryStore.getState().articles.length).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: /^delete article$/i }));
    await waitFor(() => expect(useLibraryStore.getState().articles.length).toBe(0));
  });

  it('duplicates an article including transcript', async () => {
    await putArticle({
      id: 'orig', title: 'Original', createdAt: 0, updatedAt: 0,
      durationSec: 0, transcriptText: 'abc',
    });
    render(<LibraryView />);
    await userEvent.click(await screen.findByRole('button', { name: /actions for Original/i }));
    await userEvent.click(screen.getByRole('button', { name: /^duplicate$/i }));
    expect(await screen.findByText(/copy of original/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/library/library.test.tsx`
Expected: FAIL — store/buttons missing

- [ ] **Step 3: Implement**

Create `src/features/library/libraryStore.ts`:

```ts
import { create } from 'zustand';
import type { Article, AudioChunk } from '../../core/models';
import * as repo from '../../core/db/repositories';

interface LibraryState {
  articles: Article[];
  loaded: boolean;
  refresh: () => Promise<void>;
  createArticle: () => Promise<string>;
  renameArticle: (id: string, title: string) => Promise<void>;
  duplicateArticle: (id: string) => Promise<string>;
  deleteArticle: (id: string) => Promise<void>;
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  articles: [],
  loaded: false,

  refresh: async () => {
    set({ articles: await repo.listArticles(), loaded: true });
  },

  createArticle: async () => {
    const id = crypto.randomUUID();
    const now = Date.now();
    await repo.putArticle({
      id, title: 'Untitled article',
      createdAt: now, updatedAt: now,
      durationSec: 0, transcriptText: '',
    });
    await get().refresh();
    return id;
  },

  renameArticle: async (id, title) => {
    const a = await repo.getArticle(id);
    if (!a) return;
    await repo.putArticle({ ...a, title, updatedAt: Date.now() });
    await get().refresh();
  },

  duplicateArticle: async (id) => {
    const src = await repo.getArticle(id);
    if (!src) throw new Error(`article not found: ${id}`);
    const newId = crypto.randomUUID();
    const now = Date.now();
    await repo.putArticle({
      ...src, id: newId, title: `Copy of ${src.title}`,
      createdAt: now, updatedAt: now,
    });

    // Copy audio chunks + blobs verbatim.
    const srcChunks = await repo.getChunks(id);
    if (srcChunks.length > 0) {
      const blobs = await Promise.all(srcChunks.map((c) => repo.getAudioBlob(c.blobKey)));
      const newKeys = await repo.saveSessionAudio(newId, blobs.map((b) => b!));
      const copied: AudioChunk[] = (await repo.getChunks(newId)).map((c, i) => ({
        ...c, blobKey: newKeys[i],
      }));
      const { db } = await import('../../core/db/db');
      await db.audioChunks.bulkPut(copied);
    }

    // Copy segments verbatim under the new article.
    const segs = await repo.getSegments(id);
    if (segs.length > 0) {
      await repo.putSegments(segs.map((s) => ({ ...s, id: crypto.randomUUID(), articleId: newId })));
    }

    await get().refresh();
    return newId;
  },

  deleteArticle: async (id) => {
    await repo.deleteArticleCascade(id);
    await get().refresh();
  },
}));
```

Create `src/features/library/ConfirmDialog.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onCancel}>
      <form
        onSubmit={(e) => { e.preventDefault(); onConfirm(); }}
        style={{ minWidth: 320 }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className={danger ? 'danger' : 'primary'}>{confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
```

Replace `src/features/library/LibraryView.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useLibraryStore, formatDuration } from './libraryStore';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppStore } from '../../ui/appStore';
import type { Article } from '../../core/models';

function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}

export default function LibraryView() {
  const { articles, loaded, refresh, createArticle, renameArticle, duplicateArticle, deleteArticle } =
    useLibraryStore();
  const navigate = useAppStore((s) => s.navigate);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Article | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState<Article | null>(null);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleNew = async () => {
    const id = await createArticle();
    navigate('record', id);
  };

  return (
    <main className="view">
      <div className="view-header">
        <h1>Articles</h1>
        <button className="primary" onClick={() => void handleNew()}>New article</button>
      </div>

      {!loaded ? (
        <p>Loading…</p>
      ) : articles.length === 0 ? (
        <p>No articles yet. Choose “New article” to start dictating.</p>
      ) : (
        <ul role="list" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {articles.map((a) => (
            <li
              key={a.id}
              style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: 12, display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <button
                style={{ flex: 1, textAlign: 'left', border: 'none' }}
                onClick={() => navigate('editor', a.id)}
              >
                <strong>{a.title}</strong>
                <br />
                <span style={{ color: 'var(--fg-subtle)' }}>
                  {formatDate(a.updatedAt)} · {formatDuration(a.durationSec)}
                </span>
              </button>
              <button
                aria-label={`Actions for ${a.title}`}
                aria-expanded={menuFor === a.id}
                onClick={() => setMenuFor(menuFor === a.id ? null : a.id)}
              >
                ⋮
              </button>
              {menuFor === a.id && (
                <div role="menu" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'grid' }}>
                  <button role="menuitem" onClick={() => { setRenaming(a); setRenameText(a.title); setMenuFor(null); }}>
                    Rename
                  </button>
                  <button role="menuitem" onClick={async () => { setMenuFor(null); await duplicateArticle(a.id); }}>
                    Duplicate
                  </button>
                  {/* Export item added in Task 14. */}
                  <button role="menuitem" className="danger" onClick={() => { setDeleting(a); setMenuFor(null); }}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={renaming !== null}
        title="Rename article"
        confirmLabel="Save"
        onCancel={() => setRenaming(null)}
        onConfirm={async () => {
          if (renaming) await renameArticle(renaming.id, renameText.trim() || renaming.title);
          setRenaming(null);
        }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          Title
          <input type="text" value={renameText} onChange={(e) => setRenameText(e.target.value)} autoFocus />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.title ?? ''}”?`}
        confirmLabel="Delete article"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteArticle(deleting.id);
          setDeleting(null);
        }}
      >
        <p>The transcript and all audio recordings will be permanently removed.</p>
      </ConfirmDialog>
    </main>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: library view with create, rename, duplicate, delete-with-confirm" }
```

---

### Task 10: Recording view — streaming transcription and session persistence

**Files:**
- Create: `src/features/recording/recordingStore.ts`
- Modify: `src/features/recording/RecordingView.tsx` (replace)
- Test: `src/features/recording/recording.test.tsx`

**Interfaces:**
- Consumes: `SpeechService` (Task 6), `RecorderService` (Task 7), `buildTranscript` + `FinalResult` (Task 4), `saveSessionAudio`/`putArticle`/`getArticle`/`putSegments` (Task 2), `useAppStore` (Task 8).
- Produces:
  - `useRecordingStore`: `{ status: 'idle' | 'recording'; elapsedSec: number; interimText: string; finals: FinalResult[]; errorMessage: string | null; start(): Promise<void>; stopAndSave(articleId: string): Promise<void> }`
  - `__setServicesForTest(speech: SpeechService, recorder: RecorderService): void` — test seam; production code constructs real services lazily via `makeServices()`.
  - Behavior: `start()` requests mic first; denial sets `errorMessage` mentioning microphone permission and stays `idle`. Final results append `{ text, startTimeSec: elapsed, endTimeSec: elapsed }` to `finals`. `stopAndSave` stops both services, releases the stream, persists chunks/article/segments, navigates to `'editor'`.

- [ ] **Step 1: Write failing tests**

Create `src/features/recording/recording.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import RecordingView from './RecordingView';
import { useRecordingStore, __setServicesForTest } from './recordingStore';
import { useAppStore } from '../../ui/appStore';
import { db } from '../../core/db/db';
import { putArticle } from '../../core/db/repositories';
import type { SpeechService } from '../../core/services/SpeechService';
import type { RecorderService, RecordedChunk } from '../../core/services/RecorderService';

function makeFakes(denied = false) {
  const speech = {
    onInterim: null, onFinal: null, onError: null, stopRequested: false,
    start: vi.fn(), stop: vi.fn(),
  } as unknown as SpeechService;
  const chunks: RecordedChunk[] = [
    { index: 0, blob: new Blob(['a']), startTimeSec: 0, durationSec: 30 },
    { index: 1, blob: new Blob(['b']), startTimeSec: 30, durationSec: 12 },
  ];
  const recorder = {
    requestMicrophone: vi.fn(async () => { if (denied) throw new Error('NotAllowedError'); }),
    start: vi.fn(),
    stop: vi.fn(async () => chunks),
    releaseStream: vi.fn(),
  } as unknown as RecorderService;
  return { speech, recorder };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useAppStore.setState({ view: 'record', activeArticleId: 'a1' });
  await putArticle({
    id: 'a1', title: 'Session', createdAt: 0, updatedAt: 0,
    durationSec: 0, transcriptText: '',
  });
  useRecordingStore.setState({ status: 'idle', elapsedSec: 0, interimText: '', finals: [], errorMessage: null });
});

describe('recording view', () => {
  it('streams interim text then finalizes it', async () => {
    const { speech, recorder } = makeFakes();
    __setServicesForTest(speech, recorder);
    render(<RecordingView />);

    await waitFor(() => expect(recorder.requestMicrophone).toHaveBeenCalled());
    await waitFor(() => expect(useRecordingStore.getState().status).toBe('recording'));

    speech.onInterim!('hel');
    expect(await screen.findByText(/hel/)).toBeInTheDocument();

    speech.onFinal!('hello world', 2);
    speech.onInterim!('an');
    await waitFor(() => expect(screen.getByText('hello world')).toBeInTheDocument());
  });

  it('stop saves article, ordered chunks, segments, then opens editor', async () => {
    const { speech, recorder } = makeFakes();
    __setServicesForTest(speech, recorder);
    render(<RecordingView />);
    await waitFor(() => expect(useRecordingStore.getState().status).toBe('recording'));

    speech.onFinal!('hello world', 2);
    speech.onFinal!('more words', 35);
    await userEvent.click(screen.getByRole('button', { name: /^stop$/i }));

    await waitFor(() => expect(useAppStore.getState().view).toBe('editor'));
    const article = await db.articles.get('a1');
    expect(article!.transcriptText).toBe('hello world more words');
    expect(article!.durationSec).toBeGreaterThan(0);

    const segs = (await db.transcriptSegments.where('articleId').equals('a1').toArray())
      .sort((a, b) => a.startCharOffset - b.startCharOffset);
    expect(segs.length).toBe(2);
    expect(segs[0]).toMatchObject({ startCharOffset: 0, endCharOffset: 10, audioChunkIndex: 0 });
    expect(segs[1]).toMatchObject({ startCharOffset: 12, endCharOffset: 21, audioChunkIndex: 1 });

    const chunks = (await db.audioChunks.where('articleId').equals('a1').toArray())
      .sort((a, b) => a.index - b.index);
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    expect(recorder.releaseStream).toHaveBeenCalled();
  });

  it('mic denial shows explanation and stays idle', async () => {
    const { speech, recorder } = makeFakes(true);
    __setServicesForTest(speech, recorder);
    render(<RecordingView />);
    expect(await screen.findByText(/microphone access was denied/i)).toBeInTheDocument();
    expect(useRecordingStore.getState().status).toBe('idle');
    expect(recorder.start).not.toHaveBeenCalled();
  });
});
```

Note: `RecordingView` auto-starts on mount (`useEffect`). The first test asserts recording begins without clicking Start. Keep the manual "Start recording" button as fallback UI when `status === 'idle'` and no error/auto-start has occurred.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/recording/recording.test.tsx`
Expected: FAIL — `recordingStore` missing

- [ ] **Step 3: Implement**

Create `src/features/recording/recordingStore.ts`:

```ts
import { create } from 'zustand';
import { SpeechService } from '../../core/services/SpeechService';
import { RecorderService } from '../../core/services/RecorderService';
import { buildTranscript, type FinalResult } from '../../core/services/MappingService';
import {
  saveSessionAudio, putArticle, getArticle, putSegments,
} from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

let speech: SpeechService | null = null;
let recorder: RecorderService | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

/** Test seam: inject fakes instead of constructing real browser services. */
export function __setServicesForTest(s: SpeechService, r: RecorderService): void {
  speech = s;
  recorder = r;
}

function makeServices(): void {
  speech = new SpeechService();
  recorder = new RecorderService();
}

interface RecordingState {
  status: 'idle' | 'recording';
  elapsedSec: number;
  interimText: string;
  finals: FinalResult[];
  errorMessage: string | null;
  start: () => Promise<void>;
  stopAndSave: (articleId: string) => Promise<void>;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  status: 'idle',
  elapsedSec: 0,
  interimText: '',
  finals: [],
  errorMessage: null,

  start: async () => {
    if (get().status === 'recording') return;
    set({ errorMessage: null, finals: [], interimText: '', elapsedSec: 0 });
    if (!speech || !recorder) makeServices();
    try {
      await recorder!.requestMicrophone();
    } catch {
      set({
        errorMessage:
          'Microphone access was denied. Allow microphone permission for this site in your browser settings, then try again.',
      });
      speech = null;
      recorder = null;
      return;
    }
    speech!.onInterim = (t) => set({ interimText: t });
    speech!.onFinal = (text, elapsedSec) =>
      set((s) => ({
        finals: [...s.finals, { text, startTimeSec: elapsedSec, endTimeSec: elapsedSec }],
        interimText: '',
      }));
    speech!.onError = (err, fatal) => {
      if (fatal) {
        set({ errorMessage: `Speech recognition error: ${err}. Audio keeps recording; live text paused.` });
      }
    };
    recorder!.start();
    speech!.start();
    ticker = setInterval(() => {
      set((s) => ({ elapsedSec: s.elapsedSec + 0.25 }));
    }, 250);
    set({ status: 'recording' });
  },

  stopAndSave: async (articleId) => {
    if (ticker) { clearInterval(ticker); ticker = null; }
    speech?.stop();
    const chunks = recorder ? await recorder.stop() : [];
    recorder?.releaseStream();
    const { finals, elapsedSec } = get();
    const { text, segments } = buildTranscript(finals);

    if (chunks.length > 0) {
      await saveSessionAudio(articleId, chunks.map((c) => c.blob));
    }
    const article = await getArticle(articleId);
    if (article) {
      await putArticle({
        ...article,
        transcriptText: text,
        durationSec: elapsedSec,
        updatedAt: Date.now(),
      });
    }
    if (segments.length > 0) {
      await putSegments(segments.map((s) => ({ ...s, id: crypto.randomUUID(), articleId })));
    }

    speech = null;
    recorder = null;
    set({ status: 'idle', interimText: '' });
    useAppStore.getState().navigate('editor', articleId);
  },
}));
```

Replace `src/features/recording/RecordingView.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useRecordingStore } from './recordingStore';
import { useAppStore } from '../../ui/appStore';

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RecordingView() {
  const { status, elapsedSec, interimText, finals, errorMessage, start, stopAndSave } =
    useRecordingStore();
  const articleId = useAppStore((s) => s.activeArticleId)!;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      void start();
    }
  }, [start]);

  const finalText = finals.map((f) => f.text).join(' ');

  return (
    <main className="view">
      <div className="view-header">
        <h1>
          {status === 'recording' ? '● Recording · ' : 'Ready · '}
          <time>{formatClock(elapsedSec)}</time>
        </h1>
        {status === 'recording' ? (
          <button className="primary" onClick={() => void stopAndSave(articleId)}>
            Stop
          </button>
        ) : (
          <button className="primary" onClick={() => void start()}>
            Start recording
          </button>
        )}
      </div>

      {errorMessage && (
        <p role="alert" style={{ color: 'var(--danger)' }}>{errorMessage}</p>
      )}

      <section
        aria-label="Live transcript"
        aria-live="polite"
        style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: 16, minHeight: 300, whiteSpace: 'pre-wrap',
        }}
      >
        <p style={{ margin: 0 }}>
          {finalText}{finalText && ' '}
          <span style={{ color: 'var(--fg-subtle)' }}>{interimText}</span>
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Manual check**

Run: `npm run dev`; in Chrome allow mic, dictate ~20 s, watch words appear; press Stop; editor placeholder shows (full editor arrives Task 11).

- [ ] **Step 6: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: recording view with streaming transcript and session persistence" }
```

---

### Task 11: Editor view — editing, autosave, cursor tracking, clip sidebar

**Files:**
- Create: `src/features/editor/editorStore.ts`, `src/features/editor/ClipSidebar.tsx`
- Modify: `src/features/editor/EditorView.tsx` (replace), `src/styles/global.css`
- Test: `src/features/editor/editor.test.tsx`

**Interfaces:**
- Consumes: repositories (Task 2), `adjustSegmentsAfterEdit`/`findSegmentForCursor` (Tasks 4–5), `ConfirmDialog` (Task 9), `useAppStore` (Task 8), `putArticle`.
- Produces:
  - `useEditorStore`: `{ article: Article | null; segments: TranscriptSegment[]; chunkCount: number; saved: boolean; cursorOffset: number; activeClipIndex: number | null; approximate: boolean; load(id: string): Promise<void>; setText(text: string): void; setCursor(offset: number): void }`
    - `setText` diffs against previous stored text, adjusts segments, marks unsaved, debounced 500 ms persist of article + segments, then `saved: true`.
    - `activeClipIndex` derives from `findSegmentForCursor(segments, cursorOffset)` → `segment.audioChunkIndex ?? null`; `approximate` mirrors mapping flag.
  - `ClipSidebar` props: `{ chunks: ClipRowData[]; activeClipIndex: number | null; approximate: boolean; playingIndex: number | null; progressFraction?: number; onTogglePlay(index: number): void; onSeek?(fraction: number): void }` where `ClipRowData = { index: number; startTimeSec: number; endTimeSec: number }`. Active row gets `aria-current="true"`, accent border, "~" prefix when approximate, and scrolls into view.
  - CSS classes `.editor-layout`, `.editor-main`, `.clip-sidebar`, `.visually-hidden`.

- [ ] **Step 1: Write failing tests**

Create `src/features/editor/editor.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EditorView from './EditorView';
import { useEditorStore } from './editorStore';
import { db } from '../../core/db/db';
import { putArticle, saveSessionAudio, putSegments } from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useAppStore.setState({ view: 'editor', activeArticleId: 'a1' });
  await putArticle({
    id: 'a1', title: 'Essay', createdAt: 0, updatedAt: 1,
    durationSec: 75, transcriptText: 'hello world more words',
  });
  await saveSessionAudio('a1', [new Blob(['a']), new Blob(['b']), new Blob(['c'])]);
  await putSegments([
    { id: 's1', articleId: 'a1', startTimeSec: 2, endTimeSec: 3, startCharOffset: 0, endCharOffset: 10, text: 'hello world', audioChunkIndex: 0, approximate: false },
    { id: 's2', articleId: 'a1', startTimeSec: 35, endTimeSec: 36, startCharOffset: 12, endCharOffset: 21, text: 'more words', audioChunkIndex: 1, approximate: false },
  ]);
  useEditorStore.setState({
    article: null, segments: [], chunkCount: 0, saved: true,
    cursorOffset: 0, activeClipIndex: null, approximate: false,
  });
});

describe('editor', () => {
  it('loads article text and clip list', async () => {
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    expect(ta).toHaveValue('hello world more words');
    expect(await screen.findByText(/^clip 1$/i)).toBeInTheDocument();
    expect(screen.getByText(/^clip 3$/i)).toBeInTheDocument();
  });

  it('highlights the clip containing the cursor', async () => {
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    fireEvent.select(ta, { target: { selectionStart: 14 } });
    await waitFor(() => expect(useEditorStore.getState().activeClipIndex).toBe(1));
    const active = await screen.findByRole('button', { name: /clip 2/i });
    expect(active).toHaveAttribute('aria-current', 'true');
  });

  it('marks approximate badge when cursor is unmapped', async () => {
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    fireEvent.select(ta, { target: { selectionStart: 11 } }); // gap between segments
    await waitFor(() => expect(useEditorStore.getState().approximate).toBe(true));
    const active = await screen.findByRole('button', { name: /approximately matches cursor/i });
    expect(active).toHaveAttribute('aria-current', 'true');
  });

  it('autosaves edits and shifts segment offsets', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<EditorView />);
    const ta = await screen.findByRole('textbox', { name: /transcript/i });
    fireEvent.change(ta, { target: { value: 'hello XX world more words' } });
    expect(useEditorStore.getState().saved).toBe(false);

    await vi.advanceTimersByTimeAsync(600);
    const stored = await db.articles.get('a1');
    expect(stored!.transcriptText).toBe('hello XX world more words');

    const segs = await db.transcriptSegments.where('articleId').equals('a1').toArray();
    expect(segs.find((s) => s.id === 's1')!.approximate).toBe(true);
    expect(segs.find((s) => s.id === 's2')).toMatchObject({ startCharOffset: 15, approximate: false });
    expect(useEditorStore.getState().saved).toBe(true);
    vi.useRealTimers();
  });

  it('renames the article from the editor header', async () => {
    render(<EditorView />);
    await userEvent.click(await screen.findByRole('button', { name: /^rename$/i }));
    const input = screen.getByLabelText(/title/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('Renamed!')).toBeInTheDocument();
    expect((await db.articles.get('a1'))!.title).toBe('Renamed!');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/editor/editor.test.tsx`
Expected: FAIL — `editorStore` missing

- [ ] **Step 3: Implement**

Create `src/features/editor/editorStore.ts`:

```ts
import { create } from 'zustand';
import type { Article, TranscriptSegment } from '../../core/models';
import { adjustSegmentsAfterEdit, findSegmentForCursor } from '../../core/services/MappingService';
import { getArticle, putArticle, putSegments, getSegments, getChunks } from '../../core/db/repositories';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface EditorState {
  article: Article | null;
  segments: TranscriptSegment[];
  chunkCount: number;
  saved: boolean;
  cursorOffset: number;
  activeClipIndex: number | null;
  approximate: boolean;
  load: (id: string) => Promise<void>;
  setText: (text: string) => void;
  setCursor: (offset: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  article: null,
  segments: [],
  chunkCount: 0,
  saved: true,
  cursorOffset: 0,
  activeClipIndex: null,
  approximate: false,

  load: async (id) => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    const [article, segments, chunks] = await Promise.all([
      getArticle(id), getSegments(id), getChunks(id),
    ]);
    set({
      article, segments, chunkCount: chunks.length,
      saved: true, cursorOffset: 0, activeClipIndex: null, approximate: false,
    });
    get().setCursor(0);
  },

  setText: (text) => {
    const { article, segments } = get();
    if (!article || text === article.transcriptText) return;
    const adjusted = adjustSegmentsAfterEdit(segments, article.transcriptText, text);
    const updated: Article = { ...article, transcriptText: text, updatedAt: Date.now() };
    set({ article: updated, segments: adjusted, saved: false });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void (async () => {
        const cur = get();
        if (!cur.article) return;
        await putArticle(cur.article);
        await putSegments(cur.segments);
        set({ saved: true });
      })();
    }, 500);
  },

  setCursor: (offset) => {
    const mapping = findSegmentForCursor(get().segments, offset);
    set({
      cursorOffset: offset,
      activeClipIndex: mapping.segment?.audioChunkIndex ?? null,
      approximate: mapping.approximate,
    });
  },
}));
```

Create `src/features/editor/ClipSidebar.tsx`:

```tsx
import { useEffect, useRef } from 'react';

export interface ClipRowData {
  index: number;
  startTimeSec: number;
  endTimeSec: number;
}

interface Props {
  chunks: ClipRowData[];
  activeClipIndex: number | null;
  approximate: boolean;
  playingIndex: number | null;
  progressFraction?: number;
  onTogglePlay: (index: number) => void;
  onSeek?: (fraction: number) => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ClipSidebar({
  chunks, activeClipIndex, approximate, playingIndex, progressFraction, onTogglePlay, onSeek,
}: Props) {
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeClipIndex]);

  return (
    <aside aria-label="Audio clips" className="clip-sidebar">
      <h2>Clips</h2>
      <ul role="list" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>
        {chunks.map((c) => {
          const isActive = c.index === activeClipIndex;
          const isPlaying = c.index === playingIndex;
          return (
            <li key={c.index} ref={isActive ? activeRef : undefined}>
              <button
                aria-current={isActive ? 'true' : undefined}
                aria-label={
                  `Clip ${c.index + 1}, ${fmt(c.startTimeSec)} to ${fmt(c.endTimeSec)}` +
                  (isActive && approximate ? ', approximately matches cursor' : '')
                }
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderColor: isActive ? 'var(--accent)' : undefined,
                  borderWidth: isActive ? 2 : undefined,
                }}
                onClick={() => onTogglePlay(c.index)}
              >
                <span>Clip {c.index + 1}</span>
                <span style={{ color: 'var(--fg-subtle)' }}>
                  {isActive && approximate ? '~ ' : ''}
                  {isPlaying ? '⏸' : '▶'} {fmt(c.startTimeSec)}–{fmt(c.endTimeSec)}
                </span>
              </button>
              {isPlaying && onSeek && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={progressFraction ?? 0}
                  aria-label={`Seek within clip ${c.index + 1}`}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
```

Replace `src/features/editor/EditorView.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from './editorStore';
import { useAppStore } from '../../ui/appStore';
import { getChunks, putArticle } from '../../core/db/repositories';
import { ClipSidebar, type ClipRowData } from './ClipSidebar';
import { ConfirmDialog } from '../library/ConfirmDialog';
import { usePlaybackStore } from '../playback/playbackStore';
import { ClipPlayerProvider } from '../playback/ClipPlayerProvider';

export default function EditorView() {
  const articleId = useAppStore((s) => s.activeArticleId)!;
  const { article, load, setText, setCursor, activeClipIndex, approximate, saved } =
    useEditorStore();
  const { playingIndex, toggle, seek, currentTimeSec, durationSec } = usePlaybackStore();
  const [chunks, setChunks] = useState<ClipRowData[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  useEffect(() => {
    void load(articleId);
    void getChunks(articleId).then((rows) =>
      setChunks(rows.map(({ index, startTimeSec, endTimeSec }) => ({ index, startTimeSec, endTimeSec }))),
    );
  }, [articleId, load]);

  const syncCursor = () => {
    const ta = taRef.current;
    if (ta) setCursor(ta.selectionStart ?? 0);
  };

  if (!article) {
    return <main className="view"><p>Loading…</p></main>;
  }

  return (
    <ClipPlayerProvider>
      <main className="view editor-layout">
        <div className="editor-main">
          <div className="view-header">
            <h1>{article.title}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span aria-live="polite" style={{ color: 'var(--fg-subtle)' }}>
                {saved ? 'Saved' : 'Saving…'}
              </span>
              <button aria-label="Rename" onClick={() => { setTitleDraft(article.title); setRenaming(true); }}>
                Rename
              </button>
            </div>
          </div>
          <label htmlFor="transcript" className="visually-hidden">Transcript</label>
          <textarea
            id="transcript"
            ref={taRef}
            value={article.transcriptText}
            onChange={(e) => setText(e.target.value)}
            onClick={syncCursor}
            onKeyUp={syncCursor}
            onSelect={syncCursor}
            spellCheck
            style={{ width: '100%', height: '70vh', fontSize: 18, lineHeight: 1.6 }}
          />
        </div>

        <ClipSidebar
          chunks={chunks}
          activeClipIndex={activeClipIndex}
          approximate={approximate}
          playingIndex={playingIndex}
          progressFraction={durationSec > 0 ? currentTimeSec / durationSec : 0}
          onTogglePlay={(index) => void toggle(index)}
          onSeek={seek}
        />

        <ConfirmDialog
          open={renaming}
          title="Rename article"
          confirmLabel="Save"
          onCancel={() => setRenaming(false)}
          onConfirm={async () => {
            const t = titleDraft.trim() || article.title;
            const updated = { ...article, title: t, updatedAt: Date.now() };
            await putArticle(updated);
            useEditorStore.setState({ article: updated });
            setRenaming(false);
          }}
        >
          <label style={{ display: 'grid', gap: 4 }}>
            Title
            <input type="text" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} autoFocus />
          </label>
        </ConfirmDialog>
      </main>
    </ClipPlayerProvider>
  );
}
```

This task references `../playback/playbackStore` and `ClipPlayerProvider`, which arrive in Task 12 — to keep this task green, create minimal stubs now (replaced in Task 12):

`src/features/playback/playbackStore.ts` stub:

```ts
import { create } from 'zustand';

interface PlaybackState {
  playingIndex: number | null;
  currentTimeSec: number;
  durationSec: number;
  toggle: (index: number) => Promise<void>;
  seek: (fraction: number) => void;
}

// Stub until Task 12 wires real audio playback.
export const usePlaybackStore = create<PlaybackState>((set) => ({
  playingIndex: null,
  currentTimeSec: 0,
  durationSec: 0,
  toggle: async () => set({}),
  seek: () => set({}),
}));
```

`src/features/playback/ClipPlayerProvider.tsx` stub:

```tsx
import type { ReactNode } from 'react';

export function ClipPlayerProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

Add to `src/styles/global.css`:

```css
.editor-layout { display: flex; gap: 24px; align-items: flex-start; }
.editor-main { flex: 1; min-width: 0; }
.clip-sidebar {
  width: 280px; max-height: 80vh; overflow-y: auto;
  border: 1px solid var(--border); border-radius: var(--radius); padding: 8px;
}
.clip-sidebar h2 { font-size: 1rem; margin: 4px 8px 8px; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
@media (max-width: 900px) {
  .editor-layout { flex-direction: column; }
  .clip-sidebar { width: 100%; max-height: 40vh; }
}
```

(The mobile bottom-sheet upgrade replaces this media query in Task 13.)

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: editor with autosave, cursor tracking, clip sidebar, approximate badges" }
```

---

### Task 12: Clip playback — shared audio element, play/pause, in-clip seek

**Files:**
- Modify: `src/features/playback/playbackStore.ts` (replace stub), `src/features/playback/ClipPlayerProvider.tsx`, `src/features/editor/EditorView.tsx` (minor wiring already in place)
- Test: `src/features/playback/playback.test.tsx`

**Interfaces:**
- Consumes: `getAudioBlob`/`getChunks` (Task 2), `useAppStore.activeArticleId` (Task 8).
- Produces (replacing stubs):
  - `usePlaybackStore`: `{ playingIndex: number | null; currentTimeSec: number; durationSec: number; toggle(index: number): Promise<void>; seek(fraction: number): void }`
    - Module-level shared `HTMLAudioElement`; blob URLs created per toggle and revoked on switch; `timeupdate` → `currentTimeSec`; `loadedmetadata` → `durationSec`; `ended` clears `playingIndex`.
    - `play()` failures (jsdom / autoplay policy) are swallowed — state still reflects the selection.
  - `ClipPlayerProvider`: mounts nothing itself; exists as lifetime seam for the editor screen.

- [ ] **Step 1: Write failing tests**

Create `src/features/playback/playback.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaybackStore } from './playbackStore';
import { saveSessionAudio } from '../../core/db/repositories';
import { db } from '../../core/db/db';
import { useAppStore } from '../../ui/appStore';

function Harness() {
  const { playingIndex, toggle, currentTimeSec, durationSec, seek } = usePlaybackStore();
  return (
    <div>
      <button onClick={() => void toggle(1)}>toggle-1</button>
      <button onClick={() => seek(0.5)}>seek-half</button>
      <output>playing={String(playingIndex)} t={currentTimeSec.toFixed(1)} d={durationSec.toFixed(1)}</output>
    </div>
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  useAppStore.setState({ view: 'editor', activeArticleId: 'a1' });
  await saveSessionAudio('a1', [
    new Blob(['aaaa'], { type: 'audio/webm' }),
    new Blob(['bbbb'], { type: 'audio/webm' }),
  ]);
  usePlaybackStore.setState({ playingIndex: null, currentTimeSec: 0, durationSec: 0 });
});

describe('playback store', () => {
  it('toggles playing state for a chunk index', async () => {
    render(<><Harness /></>);
    fireEvent.click(screen.getByText('toggle-1'));
    await waitFor(() => expect(usePlaybackStore.getState().playingIndex).toBe(1));
    fireEvent.click(screen.getByText('toggle-1'));
    await waitFor(() => expect(usePlaybackStore.getState().playingIndex).toBe(null));
  });

  it('seek updates currentTime proportionally to duration', async () => {
    render(<><Harness /></>);
    usePlaybackStore.setState({ durationSec: 30 });
    fireEvent.click(screen.getByText('seek-half'));
    expect(usePlaybackStore.getState().currentTimeSec).toBeCloseTo(15, 0);
  });

  it('ignores toggles for missing chunks', async () => {
    render(<><Harness /></>);
    const before = usePlaybackStore.getState().playingIndex;
    await usePlaybackStore.getState().toggle(99);
    expect(usePlaybackStore.getState().playingIndex).toBe(before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/playback/playback.test.tsx`
Expected: FAIL — stub `toggle` does nothing

- [ ] **Step 3: Implement**

Replace contents of `src/features/playback/playbackStore.ts`:

```ts
import { create } from 'zustand';
import { getAudioBlob, getChunks } from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

interface PlaybackState {
  playingIndex: number | null;
  currentTimeSec: number;
  durationSec: number;
  toggle: (index: number) => Promise<void>;
  seek: (fraction: number) => void;
}

let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.addEventListener('timeupdate', () => {
    if (audioEl) usePlaybackStore.setState({ currentTimeSec: audioEl.currentTime });
  });
  audioEl.addEventListener('loadedmetadata', () => {
    if (audioEl) usePlaybackStore.setState({ durationSec: audioEl.duration || 0 });
  });
  audioEl.addEventListener('ended', () => {
    usePlaybackStore.setState({ playingIndex: null });
  });
  return audioEl;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  playingIndex: null,
  currentTimeSec: 0,
  durationSec: 0,

  toggle: async (index) => {
    const el = ensureAudio();

    if (get().playingIndex === index) {
      el.pause();
      set({ playingIndex: null });
      return;
    }

    const articleId = useAppStore.getState().activeArticleId;
    if (!articleId) return;

    const chunks = await getChunks(articleId);
    const chunk = chunks.find((c) => c.index === index);
    if (!chunk) return;

    const blob = await getAudioBlob(chunk.blobKey);
    if (!blob) return;

    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    el.src = currentUrl;
    set({
      playingIndex: index,
      currentTimeSec: 0,
      durationSec: chunk.durationSec || el.duration || 0,
    });

    try {
      await el.play();
    } catch {
      // jsdom has no media backend; browsers may block autoplay. State stands.
    }
  },

  seek: (fraction) => {
    const el = ensureAudio();
    const d = get().durationSec || el.duration || 0;
    const t = Math.max(0, Math.min(1, fraction)) * d;
    try {
      el.currentTime = t;
    } catch {
      /* jsdom: setting currentTime unsupported */
    }
    set({ currentTimeSec: t });
  },
}));
```

Replace `src/features/playback/ClipPlayerProvider.tsx` with a documented seam (same shape as stub):

```tsx
import type { ReactNode } from 'react';

/**
 * Lifetime seam for the editor screen's shared audio element.
 * The element itself lives module-level inside playbackStore; this provider
 * marks the subtree where playback is active so future teardown hooks have a home.
 */
export function ClipPlayerProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Manual check**

Run: `npm run dev` in Chrome; record ≥ 35 s; stop; click into first sentence → Clip 1 highlighted; click it → audio plays that portion only; drag its seek bar; click another clip → previous stops, next plays.

- [ ] **Step 6: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: clip playback with shared audio element and in-clip seek" }
```

---

### Task 13: Mobile layout — collapsible bottom clip panel, auto-open

**Files:**
- Modify: `src/styles/global.css`, `src/features/editor/EditorView.tsx`
- Test: extend `src/features/editor/editor.test.tsx`

**Interfaces:**
- Produces: mobile bottom-sheet behavior — below 900px the clip panel is a fixed bottom sheet (`data-open="true"` visible); moving the cursor while closed auto-opens it; fixed round toggle button bottom-right ("Clips"/"Hide clips") with `aria-expanded`.

- [ ] **Step 1: Write failing test**

Append inside the outer `describe('editor', …)` of `src/features/editor/editor.test.tsx`:

```tsx
it('auto-opens the clip panel when the cursor moves onto a mapped region', async () => {
  render(<EditorView />);
  const ta = await screen.findByRole('textbox', { name: /transcript/i });

  const aside = screen.getByRole('complementary', { name: /audio clips/i });
  expect(aside.dataset.open).toBe('false');

  fireEvent.select(ta, { target: { selectionStart: 2 } });
  await waitFor(() => expect(aside.dataset.open).toBe('true'));

  const toggleBtn = screen.getByRole('button', { name: /hide clips/i });
  expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
});

it('manual toggle closes and reopens the panel', async () => {
  render(<EditorView />);
  const btn = await screen.findByRole('button', { name: /^clips$/i });
  await userEvent.click(btn);
  const aside = screen.getByRole('complementary', { name: /audio clips/i });
  expect(aside.dataset.open).toBe('true');
  expect(screen.getByRole('button', { name: /hide clips/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/editor/editor.test.tsx`
Expected: FAIL — no `data-open`, no toggle button

- [ ] **Step 3: Implement**

In `EditorView`, add state + auto-open effect after existing state declarations:

```tsx
const [panelOpen, setPanelOpen] = useState(false);
const prevActiveRef = useRef<number | null>(null);

useEffect(() => {
  if (activeClipIndex !== null && activeClipIndex !== prevActiveRef.current) {
    setPanelOpen(true);
  }
  prevActiveRef.current = activeClipIndex;
}, [activeClipIndex]);
```

Wrap `ClipSidebar` and add the toggle button (inside `<main>`, after `.editor-main`):

```tsx
<aside className={`clip-panel${panelOpen ? ' open' : ''}`} data-open={panelOpen ? 'true' : 'false'}>
  <ClipSidebar
    chunks={chunks}
    activeClipIndex={activeClipIndex}
    approximate={approximate}
    playingIndex={playingIndex}
    progressFraction={durationSec > 0 ? currentTimeSec / durationSec : 0}
    onTogglePlay={(index) => void toggle(index)}
    onSeek={seek}
  />
</aside>

<button
  className="clip-panel-toggle"
  aria-expanded={panelOpen}
  onClick={() => setPanelOpen((o) => !o)}
>
  {panelOpen ? 'Hide clips' : 'Clips'}
</button>
```

Replace the Task 11 `@media (max-width: 900px)` block and add the desktop hide rule in `global.css`:

```css
@media (min-width: 901px) {
  .clip-panel-toggle { display: none; }
}

@media (max-width: 900px) {
  .editor-layout { flex-direction: column; }
  .clip-panel {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    transform: translateY(100%);
    transition: transform 0.2s ease-out;
    background: var(--bg);
    border-top: 1px solid var(--border);
    z-index: 50;
  }
  .clip-panel.open { transform: translateY(0); }
  .clip-sidebar { width: 100%; max-height: 45vh; border: none; }
  .clip-panel-toggle {
    position: fixed;
    right: 16px; bottom: 16px;
    z-index: 60;
    border-radius: 24px;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Manual check**

Run: `npm run dev`; set DevTools viewport to phone width (<900px); confirm sheet hidden by default, slides up on cursor move or toggle, clips list scrolls within.

- [ ] **Step 6: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: mobile bottom-sheet clip panel with auto-open on cursor move" }
```

---

### Task 14: Export/share — transcript text + full recording

**Files:**
- Create: `src/core/services/ExportService.ts`
- Modify: `src/features/library/LibraryView.tsx` (add Export item), `src/features/editor/EditorView.tsx` (add Share button)
- Test: `src/core/services/exportService.test.ts`

**Interfaces:**
- Consumes: `getChunks`/`getAudioBlob`/`getArticle` (Task 2).
- Produces:
  ```ts
  slugify(title: string): string                       // lowercase, NFKD, non-word stripped, '-' joined, max 64, fallback 'untitled'
  downloadBlob(blob: Blob, filename: string): void     // temp anchor click + revoke
  exportTranscript(articleId: string): Promise<void>   // article.transcriptText as '<slug>.txt'; navigator.share files when canShare, else download
  exportFullRecording(articleId: string): Promise<void>// ordered chunk blobs concatenated -> '<slug>.webm'; share-or-download
  ```
  Concatenation note (per spec §11): naive `new Blob(chunks)` concatenation of Chrome-recorded webm streams is accepted behavior for MVP; verified manually during Task 14's manual check.

- [ ] **Step 1: Write failing tests**

Create `src/core/services/exportService.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { slugify } from './ExportService';

describe('slugify', () => {
  it.each([
    ['My Great Essay!', 'my-great-essay'],
    ['  spaced  out  ', 'spaced-out'],
    ['???', 'untitled'],
    ['', 'untitled'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('truncates long titles to 64 chars', () => {
    const out = slugify('a'.repeat(100));
    expect(out.length).toBeLessThanOrEqual(64);
  });
});
```

(The `downloadBlob` anchor-click mechanics are exercised by the manual check in Step 5 rather than jsdom mocks — mocking `document.createElement`/`URL.createObjectURL` adds brittleness without covering real behavior.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/services/exportService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/core/services/ExportService.ts`:

```ts
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
  return slug || 'untitled';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  const file = new File([blob], filename, { type: blob.type });
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title });
    return;
  }
  downloadBlob(blob, filename);
}

export async function exportTranscript(articleId: string): Promise<void> {
  const { getArticle } = await import('../db/repositories');
  const article = await getArticle(articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);
  const blob = new Blob([article.transcriptText], { type: 'text/plain;charset=utf-8' });
  await shareOrDownload(blob, `${slugify(article.title)}.txt`, article.title);
}

export async function exportFullRecording(articleId: string): Promise<void> {
  const { getChunks, getAudioBlob } = await import('../db/repositories');
  const [{ getArticle }, chunks] = await Promise.all([
    import('../db/repositories').then((m) => ({ getArticle: m.getArticle })),
    getChunks(articleId),
  ]);
  const article = await getArticle(articleId);
  if (!article) throw new Error(`article not found: ${articleId}`);
  if (chunks.length === 0) throw new Error('no audio recorded for this article');
  const blobs: Blob[] = [];
  for (const c of chunks) {
    const b = await getAudioBlob(c.blobKey);
    if (b) blobs.push(b);
  }
  const full = new Blob(blobs, { type: 'audio/webm' });
  await shareOrDownload(full, `${slugify(article.title)}.webm`, article.title);
}
```

Modify `src/features/library/LibraryView.tsx` menu — insert between Duplicate and Delete:

```tsx
<button role="menuitem" onClick={async () => { setMenuFor(null); await exportTranscript(a.id); }}>
  Export text
</button>
<button role="menuitem" onClick={async () => { setMenuFor(null); await exportFullRecording(a.id); }}>
  Export audio
</button>
```

with imports at top:

```tsx
import { exportTranscript, exportFullRecording } from '../../core/services/ExportService';
```

Wrap both handlers with try/catch that shows `showToast('Export failed')` on error (import `useToastStore` from `'../../ui/toastStore'`).

Modify `src/features/editor/EditorView.tsx` header controls (between Saved indicator and Rename):

```tsx
<button
  aria-label="Share"
  onClick={async () => {
    try {
      await exportTranscript(article.id);
    } catch {
      showToast('Export failed');
    }
  }}
>
  Share
</button>
```

with `const showToast = useToastStore((s) => s.showToast);` and the same import.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Manual check**

Run: `npm run dev` in Chrome; record an article; Share button downloads/shares `.txt`; library menu "Export audio" produces a playable `.webm` (verify in Chrome tab — this validates spec §11's concatenation assumption).

- [ ] **Step 6: Commit**

```powershell
git add -A; if ($?) { git commit -m "feat: transcript and full-recording export via share sheet or download" }
```

---

## Final verification (after Task 14)

- [ ] `npm test` — all suites green.
- [ ] `npm run build` — TypeScript strict build passes.
- [ ] Full manual pass in Chrome (desktop + DevTools mobile viewport): record → stream → stop → edit → cursor-highlight → play → approximate badge in edited region → autosave → rename/duplicate/delete/export.
- [ ] Spec acceptance criteria walkthrough (`docs/superpowers/specs/2026-08-24-dictation-scribe-design.md` §10).

## Deliberately deferred

- Playwright browser-level E2E (spec §9 lists integration tests via RTL service-mocks instead; Playwright can be added later without refactoring).
- Virtualization for >100 clips — render cost at 100+ simple rows is acceptable for MVP; revisit with measured jank.
- CI workflow — not in spec's MVP scope.
- IndexedDB write-failure toast (spec §7 last row) — failed autosaves leave the "Saving…" indicator stuck and retry on the next edit; explicit error toast deferred.



