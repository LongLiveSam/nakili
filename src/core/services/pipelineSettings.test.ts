import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_VOCAB_THRESHOLD,
  loadTransformScript,
  loadVocabularyTerms,
  readPipelineOptions,
  readVocabularyThreshold,
  storageFlag,
} from './pipelineSettings';

beforeEach(() => {
  localStorage.clear();
});

describe('storageFlag', () => {
  it('honours an absent key with the caller fallback', () => {
    expect(storageFlag('missing', true)).toBe(true);
    expect(storageFlag('missing', false)).toBe(false);
  });

  it('reads on/off writes', () => {
    localStorage.setItem('k', 'on');
    expect(storageFlag('k', false)).toBe(true);
    localStorage.setItem('k', 'off');
    expect(storageFlag('k', true)).toBe(false);
  });
});

describe('loadVocabularyTerms', () => {
  it('splits the textarea into trimmed, non-empty terms', () => {
    localStorage.setItem('nakili-vocab', '  Nakili \n\n Kubernetes\nChargeBee  ');
    expect(loadVocabularyTerms()).toEqual(['Nakili', 'Kubernetes', 'ChargeBee']);
  });

  it('returns an empty list when unset', () => {
    expect(loadVocabularyTerms()).toEqual([]);
  });
});

describe('readVocabularyThreshold', () => {
  it('defaults to Handy\'s 0.18', () => {
    expect(DEFAULT_VOCAB_THRESHOLD).toBe(0.18);
    expect(readVocabularyThreshold()).toBe(0.18);
  });

  it('accepts a stored value inside (0, 1]', () => {
    localStorage.setItem('nakili-vocab-threshold', '0.3');
    expect(readVocabularyThreshold()).toBe(0.3);
  });

  it('falls back on nonsense values', () => {
    localStorage.setItem('nakili-vocab-threshold', 'wide open');
    expect(readVocabularyThreshold()).toBe(DEFAULT_VOCAB_THRESHOLD);
    localStorage.setItem('nakili-vocab-threshold', '0');
    expect(readVocabularyThreshold()).toBe(DEFAULT_VOCAB_THRESHOLD);
  });
});

describe('readPipelineOptions', () => {
  it('matches the shipped defaults', () => {
    expect(readPipelineOptions()).toEqual({
      voiceCommands: true,
      fillers: false,
      vocabularyTerms: [],
      vocabularyThreshold: 0.18,
      typography: false,
    });
  });

  it('drops vocabulary terms when correction is turned off', () => {
    localStorage.setItem('nakili-vocab', 'Nakili');
    localStorage.setItem('nakili-vocab-correct', 'off');
    expect(readPipelineOptions().vocabularyTerms).toEqual([]);
  });

  it('includes vocabulary terms when correction is on', () => {
    localStorage.setItem('nakili-vocab', 'Nakili');
    expect(readPipelineOptions().vocabularyTerms).toEqual(['Nakili']);
  });

  it('reads the optional stage toggles', () => {
    localStorage.setItem('nakili-remove-fillers', 'on');
    localStorage.setItem('nakili-typography-auto', 'on');
    const options = readPipelineOptions();
    expect(options.fillers).toBe(true);
    expect(options.typography).toBe(true);
  });
});

describe('loadTransformScript', () => {
  it('returns the stored script or an empty string', () => {
    expect(loadTransformScript()).toBe('');
    localStorage.setItem('nakili-transform-script', 'return text;');
    expect(loadTransformScript()).toBe('return text;');
  });
});
