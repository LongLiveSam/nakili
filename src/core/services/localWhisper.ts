/**
 * Client wrapper for the local Whisper worker (experimental).
 * Main thread decodes the chunk blob to 16 kHz mono PCM, the worker runs the model.
 */
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

export async function transcribeClipLocally(
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const w = getWorker();
  if (!w) throw new Error('WORKER UNAVAILABLE');
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
    const pcm = rendered.getChannelData(0);

    return await new Promise<string>((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        const d = e.data as { text?: string; error?: string; progress?: number };
        if ('progress' in d && typeof d.progress === 'number') {
          onProgress?.(d.progress);
          return;
        }
        cleanup();
        if ('error' in d && d.error) reject(new Error(d.error));
        else resolve(String(d.text ?? ''));
      };
      const cleanup = () => w.removeEventListener('message', onMessage);
      w.addEventListener('message', onMessage);
      w.postMessage({ pcm, sampleRate: 16000 }, [pcm.buffer]);
    });
  } finally {
    void ctx.close().catch(() => {});
  }
}
