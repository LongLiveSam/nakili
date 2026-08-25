/// <reference lib="webworker" />
/**
 * Local Whisper transcription worker (experimental).
 * Downloads the model from HuggingFace on first use, then caches it.
 * Messages in:  { pcm: Float32Array, sampleRate: number }
 * Messages out: { text: string } | { error: string } | { progress: number }
 */
let pipePromise: Promise<{
  (audio: Float32Array, opts: Record<string, unknown>): Promise<{ text: string }>;
}> | null = null;

async function getPipe() {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        quantized: true,
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p?.status === 'progress' && typeof p.progress === 'number') {
            self.postMessage({ progress: p.progress / 100 });
          }
        },
      }) as never;
    })();
  }
  return pipePromise;
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { pcm } = e.data as { pcm: Float32Array; sampleRate?: number };
  try {
    const pipe = await getPipe();
    const out = await pipe(pcm, { chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ text: out.text.trim() });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
});
