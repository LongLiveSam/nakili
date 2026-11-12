import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_WHISPER_MODEL,
  WHISPER_KEYS,
  WHISPER_MODELS,
  cachedModelBytes,
  clearModelCache,
  formatModelBytes,
  isWhisperModelId,
  readWhisperSettings,
  whisperLanguageFor,
  whisperModelInfo,
  writeWhisperSettings,
} from './whisperModels';

describe('whisper model settings', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to the tiny English model, quantized, auto language', () => {
    expect(readWhisperSettings()).toEqual({
      model: DEFAULT_WHISPER_MODEL,
      quantized: true,
      language: 'auto',
    });
  });

  it('round-trips a chosen model, precision and language', () => {
    writeWhisperSettings({ model: 'Xenova/whisper-base', quantized: false, language: 'de' });
    expect(readWhisperSettings()).toEqual({
      model: 'Xenova/whisper-base',
      quantized: false,
      language: 'de',
    });
  });

  it('ignores an unknown stored model', () => {
    localStorage.setItem(WHISPER_KEYS.model, 'Xenova/whisper-huge');
    expect(readWhisperSettings().model).toBe(DEFAULT_WHISPER_MODEL);
  });

  it('validates model ids and falls back to the first entry', () => {
    expect(isWhisperModelId('Xenova/whisper-small.en')).toBe(true);
    expect(isWhisperModelId('nope')).toBe(false);
    expect(whisperModelInfo('nope').id).toBe(WHISPER_MODELS[0].id);
  });

  it('maps a recognition locale to a Whisper language code', () => {
    expect(whisperLanguageFor('en-US')).toBe('en');
    expect(whisperLanguageFor('pt-BR')).toBe('pt');
    expect(whisperLanguageFor('auto')).toBe('auto');
    expect(whisperLanguageFor('')).toBe('auto');
  });

  it('formats cache sizes', () => {
    expect(formatModelBytes(0)).toBe('0 MB');
    expect(formatModelBytes(42 * 1024 * 1024)).toBe('42 MB');
    expect(formatModelBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });
});

describe('model cache helpers', () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;

  afterEach(() => {
    if (originalCaches === undefined) delete (globalThis as { caches?: unknown }).caches;
    else (globalThis as { caches?: unknown }).caches = originalCaches;
  });

  function fakeCaches(entries: Array<{ url: string; bytes: number }>) {
    const store = new Map(entries.map((e) => [e.url, e.bytes]));
    const cache = {
      keys: async () => [...store.keys()].map((url) => ({ url })),
      match: async (req: { url: string }) => {
        const bytes = store.get(req.url);
        return bytes === undefined
          ? undefined
          : { headers: { get: (h: string) => (h === 'content-length' ? String(bytes) : null) } };
      },
      delete: async (req: { url: string }) => store.delete(req.url),
    };
    return {
      keys: async () => ['transformers-cache'],
      open: async () => cache,
      store,
    };
  }

  it('sums only the files belonging to the requested model', async () => {
    (globalThis as { caches?: unknown }).caches = fakeCaches([
      { url: 'https://huggingface.co/Xenova/whisper-tiny.en/onnx/model_quantized.onnx', bytes: 1000 },
      { url: 'https://huggingface.co/Xenova/whisper-tiny.en/tokenizer.json', bytes: 500 },
      { url: 'https://huggingface.co/Xenova/whisper-base/onnx/model_quantized.onnx', bytes: 9000 },
    ]);
    expect(await cachedModelBytes('Xenova/whisper-tiny.en')).toBe(1500);
    expect(await cachedModelBytes('Xenova/whisper-small')).toBe(0);
  });

  it('removes only the requested model and reports the count', async () => {
    const fake = fakeCaches([
      { url: 'https://huggingface.co/Xenova/whisper-tiny.en/onnx/model_quantized.onnx', bytes: 1000 },
      { url: 'https://huggingface.co/Xenova/whisper-base/onnx/model_quantized.onnx', bytes: 9000 },
    ]);
    (globalThis as { caches?: unknown }).caches = fake;
    expect(await clearModelCache('Xenova/whisper-tiny.en')).toBe(1);
    expect([...fake.store.keys()]).toEqual([
      'https://huggingface.co/Xenova/whisper-base/onnx/model_quantized.onnx',
    ]);
  });

  it('returns zero when Cache Storage is unavailable', async () => {
    delete (globalThis as { caches?: unknown }).caches;
    expect(await cachedModelBytes('Xenova/whisper-tiny.en')).toBe(0);
    expect(await clearModelCache('Xenova/whisper-tiny.en')).toBe(0);
  });
});

describe('whisper model table', () => {
  it('offers English and multilingual variants at three sizes', () => {
    expect(WHISPER_MODELS).toHaveLength(6);
    expect(WHISPER_MODELS.filter((m) => m.multilingual)).toHaveLength(3);
    expect(WHISPER_MODELS.every((m) => m.downloadMB > 0)).toBe(true);
  });

  it('does not touch the network when reading settings', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    readWhisperSettings();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
