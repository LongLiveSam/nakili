/**
 * Client wrapper for the local Whisper worker.
 * Main thread decodes audio to 16 kHz mono PCM, the worker runs the model.
 *
 * Settings (model size, precision, language) come from `whisperModels.ts`;
 * silence is trimmed before the model sees the clip, the way faster-whisper's
 * VAD filter does.
 */
import { trimSilence } from './audioAnalysis';
import { readWhisperSettings } from './whisperModels';

export function isWhisperBetaEnabled(): boolean {
  try {
    return localStorage.getItem('nakili-whisper-beta') === 'on';
  } catch {
    return false;
  }
}

let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('../../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  return worker;
}

type WorkerReply = { text?: string; error?: string; progress?: number; ready?: boolean };

function runWorker(
  payload: Record<string, unknown>,
  transfer: Transferable[],
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error('WORKER UNAVAILABLE'));
  return new Promise<string>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as WorkerReply;
      if (typeof d.progress === 'number') {
        onProgress?.(d.progress);
        return;
      }
      cleanup();
      if (d.error) reject(new Error(d.error));
      else resolve(String(d.text ?? ''));
    };
    const cleanup = () => w.removeEventListener('message', onMessage);
    w.addEventListener('message', onMessage);
    w.postMessage(payload, transfer);
  });
}

/** Transcribe 16 kHz mono PCM with the configured local model. */
export async function transcribePcmLocally(
  pcm: Float32Array,
  sampleRate: number,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { model, quantized, language } = readWhisperSettings();
  const trimmed = trimSilence(pcm, sampleRate);
  if (trimmed.length === 0) return '';
  return runWorker(
    { pcm: trimmed, sampleRate, model, quantized, language },
    [trimmed.buffer],
    onProgress,
  );
}

export async function transcribeClipLocally(
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const Ctx = window.AudioContext;
  if (!Ctx) throw new Error('AUDIO DECODE UNAVAILABLE');
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    // Whisper expects 16 kHz mono.
    const offline = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
    const src = offline.createBufferSource();
    src.buffer = buf;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return await transcribePcmLocally(rendered.getChannelData(0), 16000, onProgress);
  } finally {
    void ctx.close().catch(() => {});
  }
}

/** Download the selected model into Cache Storage without transcribing. */
export async function preloadWhisperModel(
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const { model, quantized } = readWhisperSettings();
  const w = getWorker();
  if (!w) throw new Error('WORKER UNAVAILABLE');
  await new Promise<void>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as WorkerReply;
      if (typeof d.progress === 'number') {
        onProgress?.(d.progress);
        return;
      }
      cleanup();
      if (d.error) reject(new Error(d.error));
      else if (d.ready) resolve();
      else reject(new Error('UNEXPECTED WORKER REPLY'));
    };
    const cleanup = () => w.removeEventListener('message', onMessage);
    w.addEventListener('message', onMessage);
    w.postMessage({ preload: true, model, quantized });
  });
}
