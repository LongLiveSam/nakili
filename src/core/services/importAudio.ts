/**
 * Import an existing audio file and transcribe it locally.
 *
 * Borrowed from Meetily's "Import & Enhance": a file becomes a normal
 * recording with 30-second clips, so playback, editing and export all work the
 * same way as a live session. Transcription uses the local Whisper engine, so
 * nothing is uploaded.
 */
import { encodeWav } from './audioEncoders';
import { transcribePcmLocally } from './localWhisper';
import { putArticle, putSegments, saveSessionAudio } from '../db/repositories';
import type { TranscriptSegment } from '../models';

export const IMPORT_CHUNK_SECONDS = 30;
export const IMPORT_SAMPLE_RATE = 16000;

export interface PcmClip {
  index: number;
  startTimeSec: number;
  durationSec: number;
  blob: Blob;
}

export interface ImportedTranscript {
  text: string;
  segments: Array<Omit<TranscriptSegment, 'id' | 'articleId'>>;
}

/** Split mono PCM into fixed-length clips, each encoded as a WAV blob. */
export function splitPcmIntoClips(
  pcm: Float32Array,
  sampleRate: number,
  chunkSeconds = IMPORT_CHUNK_SECONDS,
): PcmClip[] {
  const perChunk = Math.max(1, Math.floor(sampleRate * chunkSeconds));
  const clips: PcmClip[] = [];
  for (let start = 0, index = 0; start < pcm.length; start += perChunk, index++) {
    const slice = pcm.subarray(start, Math.min(pcm.length, start + perChunk));
    if (slice.length === 0) continue;
    clips.push({
      index,
      startTimeSec: index * chunkSeconds,
      durationSec: slice.length / sampleRate,
      blob: encodeWav([slice], sampleRate),
    });
  }
  return clips;
}

/**
 * Join per-clip text into one transcript and map each clip to a segment.
 * Empty clips keep their audio but produce no segment.
 */
export function buildImportedTranscript(
  texts: string[],
  chunkSeconds = IMPORT_CHUNK_SECONDS,
): ImportedTranscript {
  const parts: string[] = [];
  const segments: ImportedTranscript['segments'] = [];
  let cursor = 0;

  texts.forEach((raw, index) => {
    const text = raw.trim();
    if (!text) return;
    if (parts.length > 0) cursor += 2; // the "\n\n" separator
    const startCharOffset = cursor;
    const endCharOffset = startCharOffset + text.length - 1;
    parts.push(text);
    cursor = endCharOffset + 1;
    segments.push({
      startTimeSec: index * chunkSeconds,
      endTimeSec: (index + 1) * chunkSeconds,
      startCharOffset,
      endCharOffset,
      text,
      audioChunkIndex: index,
      approximate: false,
    });
  });

  return { text: parts.join('\n\n'), segments };
}

export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || 'Imported recording';
}

/** Decode any browser-supported audio file to 16 kHz mono PCM. */
export async function decodeAudioFile(
  file: File,
): Promise<{ pcm: Float32Array; sampleRate: number; durationSec: number }> {
  const Ctx = window.AudioContext;
  if (!Ctx) throw new Error('AUDIO DECODE UNAVAILABLE');
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const frames = Math.max(1, Math.ceil(buf.duration * IMPORT_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frames, IMPORT_SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = buf;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return {
      pcm: rendered.getChannelData(0),
      sampleRate: IMPORT_SAMPLE_RATE,
      durationSec: buf.duration,
    };
  } finally {
    void ctx.close().catch(() => {});
  }
}

export interface ImportOptions {
  onStatus?: (message: string) => void;
  onProgress?: (fraction: number) => void;
}

export interface ImportResult {
  articleId: string;
  text: string;
  clipCount: number;
  failedClips: number;
}

/**
 * Decode, chunk, store and transcribe a file. The article and its audio are
 * saved before transcription starts, so a failure mid-way still leaves a
 * playable recording rather than losing the import.
 */
export async function importAudioFile(file: File, opts: ImportOptions = {}): Promise<ImportResult> {
  opts.onStatus?.('[DECODING AUDIO…]');
  const { pcm, sampleRate, durationSec } = await decodeAudioFile(file);
  const clips = splitPcmIntoClips(pcm, sampleRate);
  if (clips.length === 0) throw new Error('NO AUDIO IN FILE');

  const articleId = crypto.randomUUID();
  const now = Date.now();
  const title = titleFromFilename(file.name);
  await putArticle({
    id: articleId,
    title,
    createdAt: now,
    updatedAt: now,
    durationSec,
    transcriptText: '',
  });
  await saveSessionAudio(articleId, clips.map((c) => c.blob), {
    chunkSeconds: IMPORT_CHUNK_SECONDS,
    durationsSec: clips.map((c) => c.durationSec),
  });

  const perChunk = Math.max(1, Math.floor(sampleRate * IMPORT_CHUNK_SECONDS));
  const texts: string[] = [];
  let failedClips = 0;

  for (const clip of clips) {
    opts.onStatus?.(`[TRANSCRIBING CLIP ${clip.index + 1} OF ${clips.length}…]`);
    const slice = pcm.subarray(clip.index * perChunk, (clip.index + 1) * perChunk);
    try {
      const text = await transcribePcmLocally(slice, sampleRate, (fraction) => {
        const overall = (clip.index + fraction) / clips.length;
        opts.onProgress?.(overall);
      });
      texts.push(text);
    } catch {
      failedClips += 1;
      texts.push('');
    }
  }

  const { text, segments } = buildImportedTranscript(texts);
  await putArticle({
    id: articleId,
    title,
    createdAt: now,
    updatedAt: Date.now(),
    durationSec,
    transcriptText: text,
  });
  if (segments.length > 0) {
    await putSegments(
      segments.map((s) => ({ ...s, id: crypto.randomUUID(), articleId })),
    );
  }

  return { articleId, text, clipCount: clips.length, failedClips };
}
