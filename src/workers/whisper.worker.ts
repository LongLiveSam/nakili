/// <reference lib="webworker" />
/**
 * Local Whisper transcription worker.
 * Downloads the selected model from HuggingFace on first use, then caches it.
 *
 * Messages in:  { pcm, sampleRate, model, quantized, language }
 *               { preload: true, model, quantized }
 * Messages out: { text } | { error } | { progress } | { ready: true }
 *
 * Model size and precision are user choices (faster-whisper's model table);
 * one pipeline is kept per model+precision pair so switching back is instant.
 */
type Pipe = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string }>;

const pipes = new Map<string, Promise<Pipe>>();

function getPipe(model: string, quantized: boolean): Promise<Pipe> {
  const key = `${model}|${quantized ? 'q8' : 'fp32'}`;
  const existing = pipes.get(key);
  if (existing) return existing;

  const created = (async () => {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;
    return pipeline('automatic-speech-recognition', model, {
      quantized,
      progress_callback: (p: { status?: string; progress?: number }) => {
        if (p?.status === 'progress' && typeof p.progress === 'number') {
          self.postMessage({ progress: p.progress / 100 });
        }
      },
    }) as unknown as Pipe;
  })();

  pipes.set(key, created);
  // A failed download must not poison the cache for the next attempt.
  created.catch(() => pipes.delete(key));
  return created;
}

self.addEventListener('message', async (e: MessageEvent) => {
  const data = e.data as {
    pcm?: Float32Array;
    sampleRate?: number;
    model?: string;
    quantized?: boolean;
    language?: string;
    preload?: boolean;
  };
  const model = data.model || 'Xenova/whisper-tiny.en';
  const quantized = data.quantized !== false;

  try {
    const pipe = await getPipe(model, quantized);
    if (data.preload) {
      self.postMessage({ ready: true });
      return;
    }
    if (!data.pcm || data.pcm.length === 0) {
      self.postMessage({ text: '' });
      return;
    }
    const opts: Record<string, unknown> = { chunk_length_s: 30, stride_length_s: 5 };
    if (data.language && data.language !== 'auto') {
      opts.language = data.language;
      opts.task = 'transcribe';
    }
    const out = await pipe(data.pcm, opts);
    self.postMessage({ text: out.text.trim() });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
});
