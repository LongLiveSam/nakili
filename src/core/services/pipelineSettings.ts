/**
 * Reads the pipeline's on/off switches from the settings store.
 *
 * Kept separate from `pipeline.ts` so the pipeline stays a pure function that
 * takes its options explicitly. Keys are versioned by convention only; the
 * settings-migration work (Handy's `settings_schema_version` idea) is a later
 * step.
 */

import type { PipelineOptions } from './pipeline';

export const DEFAULT_VOCAB_THRESHOLD = 0.18;

export const PIPELINE_KEYS = {
  voiceCommands: 'nakili-voice-cmds',
  fillers: 'nakili-remove-fillers',
  vocabulary: 'nakili-vocab-correct',
  threshold: 'nakili-vocab-threshold',
  typography: 'nakili-typography-auto',
  script: 'nakili-transform-script',
} as const;

/** Toggles are written as 'on'/'off'; an absent key falls back to `fallback`. */
export function storageFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'on';
  } catch {
    return fallback;
  }
}

export function loadVocabularyTerms(): string[] {
  try {
    return (localStorage.getItem('nakili-vocab') ?? '')
      .split('\n')
      .map((term) => term.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function readVocabularyThreshold(): number {
  try {
    const raw = Number(localStorage.getItem(PIPELINE_KEYS.threshold));
    return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : DEFAULT_VOCAB_THRESHOLD;
  } catch {
    return DEFAULT_VOCAB_THRESHOLD;
  }
}

export function readPipelineOptions(): PipelineOptions {
  const vocabularyOn = storageFlag(PIPELINE_KEYS.vocabulary, true);
  return {
    voiceCommands: storageFlag(PIPELINE_KEYS.voiceCommands, true),
    fillers: storageFlag(PIPELINE_KEYS.fillers, false),
    vocabularyTerms: vocabularyOn ? loadVocabularyTerms() : [],
    vocabularyThreshold: readVocabularyThreshold(),
    typography: storageFlag(PIPELINE_KEYS.typography, false),
  };
}

export function loadTransformScript(): string {
  try {
    return localStorage.getItem(PIPELINE_KEYS.script) ?? '';
  } catch {
    return '';
  }
}
