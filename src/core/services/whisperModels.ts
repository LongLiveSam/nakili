/**
 * Local Whisper engine settings and model cache helpers.
 *
 * Borrowed from faster-whisper (model sizes, int8 quantization, explicit
 * language) and Meetily (a model manager that shows what is downloaded and
 * lets you remove it). Everything here is browser-local: the model files live
 * in the Cache Storage bucket that transformers.js writes to.
 */

export type WhisperModelId =
  | 'Xenova/whisper-tiny.en'
  | 'Xenova/whisper-tiny'
  | 'Xenova/whisper-base.en'
  | 'Xenova/whisper-base'
  | 'Xenova/whisper-small.en'
  | 'Xenova/whisper-small';

export interface WhisperModelInfo {
  id: WhisperModelId;
  label: string;
  params: string;
  /** Approximate first-download size in MB (quantized weights + tokenizer). */
  downloadMB: number;
  multilingual: boolean;
}

export const WHISPER_MODELS: WhisperModelInfo[] = [
  { id: 'Xenova/whisper-tiny.en', label: 'Tiny · English', params: '39M', downloadMB: 42, multilingual: false },
  { id: 'Xenova/whisper-tiny', label: 'Tiny · multilingual', params: '39M', downloadMB: 44, multilingual: true },
  { id: 'Xenova/whisper-base.en', label: 'Base · English', params: '74M', downloadMB: 78, multilingual: false },
  { id: 'Xenova/whisper-base', label: 'Base · multilingual', params: '74M', downloadMB: 80, multilingual: true },
  { id: 'Xenova/whisper-small.en', label: 'Small · English', params: '244M', downloadMB: 250, multilingual: false },
  { id: 'Xenova/whisper-small', label: 'Small · multilingual', params: '244M', downloadMB: 255, multilingual: true },
];

export const DEFAULT_WHISPER_MODEL: WhisperModelId = 'Xenova/whisper-tiny.en';

export const WHISPER_KEYS = {
  enabled: 'nakili-whisper-beta',
  model: 'nakili-whisper-model',
  quantized: 'nakili-whisper-quantized',
  language: 'nakili-whisper-lang',
} as const;

export interface WhisperSettings {
  model: WhisperModelId;
  quantized: boolean;
  /** ISO-639-1 code, or 'auto' to let the model detect it. */
  language: string;
}

export function isWhisperModelId(value: string): value is WhisperModelId {
  return WHISPER_MODELS.some((m) => m.id === value);
}

export function whisperModelInfo(id: string): WhisperModelInfo {
  return WHISPER_MODELS.find((m) => m.id === id) ?? WHISPER_MODELS[0];
}

export function readWhisperSettings(): WhisperSettings {
  try {
    const model = localStorage.getItem(WHISPER_KEYS.model) ?? '';
    const quantized = localStorage.getItem(WHISPER_KEYS.quantized);
    const language = localStorage.getItem(WHISPER_KEYS.language) ?? 'auto';
    return {
      model: isWhisperModelId(model) ? model : DEFAULT_WHISPER_MODEL,
      quantized: quantized === null ? true : quantized === 'on',
      language: language || 'auto',
    };
  } catch {
    return { model: DEFAULT_WHISPER_MODEL, quantized: true, language: 'auto' };
  }
}

export function writeWhisperSettings(settings: WhisperSettings): void {
  try {
    localStorage.setItem(WHISPER_KEYS.model, settings.model);
    localStorage.setItem(WHISPER_KEYS.quantized, settings.quantized ? 'on' : 'off');
    localStorage.setItem(WHISPER_KEYS.language, settings.language);
  } catch {
    /* storage unavailable */
  }
}

/** Recognition locales are BCP-47; Whisper wants the bare language subtag. */
export function whisperLanguageFor(recognitionLocale: string): string {
  if (!recognitionLocale || recognitionLocale === 'auto') return 'auto';
  return recognitionLocale.split('-')[0]?.toLowerCase() || 'auto';
}

const CACHE_NAME = 'transformers-cache';

async function modelRequests(modelId: string): Promise<Array<{ cache: Cache; request: Request }>> {
  if (typeof caches === 'undefined') return [];
  const found: Array<{ cache: Cache; request: Request }> = [];
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    for (const request of requests) {
      if (request.url.includes(modelId)) found.push({ cache, request });
    }
  }
  return found;
}

/** Bytes of this model already in Cache Storage (0 when nothing is cached). */
export async function cachedModelBytes(modelId: string): Promise<number> {
  try {
    const entries = await modelRequests(modelId);
    let total = 0;
    for (const { cache, request } of entries) {
      const response = await cache.match(request);
      const length = Number(response?.headers.get('content-length') ?? 0);
      if (Number.isFinite(length) && length > 0) total += length;
    }
    return total;
  } catch {
    return 0;
  }
}

/** Delete every cached file for one model. Returns how many entries went. */
export async function clearModelCache(modelId: string): Promise<number> {
  try {
    const entries = await modelRequests(modelId);
    for (const { cache, request } of entries) await cache.delete(request);
    return entries.length;
  } catch {
    return 0;
  }
}

export function formatModelBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export { CACHE_NAME as WHISPER_CACHE_NAME };
