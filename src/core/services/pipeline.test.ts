import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline';

describe('runPipeline', () => {
  it('returns the input untouched with zero counts when every stage is off', () => {
    const r = runPipeline('um hello  world');
    expect(r.text).toBe('um hello  world');
    expect(r.applied).toEqual({ voiceCommands: 0, fillers: 0, vocabulary: 0, typography: 0 });
  });

  it('applies voice commands first', () => {
    const r = runPipeline('hello new paragraph world', { voiceCommands: true });
    expect(r.text).toBe('Hello\n\nWorld');
    expect(r.applied.voiceCommands).toBe(1);
  });

  it('removes filler words when enabled', () => {
    const r = runPipeline('hello um world', { fillers: true });
    expect(r.text).toBe('hello world');
    expect(r.applied.fillers).toBe(1);
  });

  it('leaves fillers in place when disabled', () => {
    const r = runPipeline('hello um world', { voiceCommands: true });
    expect(r.text).toBe('Hello um world');
    expect(r.applied.fillers).toBe(0);
  });

  it('corrects vocabulary after fillers so the n-gram is clean', () => {
    const r = runPipeline('um nakilli works', {
      fillers: true,
      vocabularyTerms: ['Nakili'],
    });
    expect(r.text).toBe('Nakili works');
    expect(r.applied.vocabulary).toBe(1);
  });

  it('keeps paragraph breaks inserted by voice commands through later stages', () => {
    const r = runPipeline('intro new paragraph nakilli', {
      voiceCommands: true,
      vocabularyTerms: ['Nakili'],
    });
    expect(r.text).toBe('Intro\n\nNakili');
  });

  it('applies typography last', () => {
    const r = runPipeline('wait -- really?', { typography: true });
    expect(r.text).toBe('wait \u2014 really?');
    expect(r.applied.typography).toBe(1);
  });

  it('reports typography as unchanged when nothing needs converting', () => {
    const r = runPipeline('plain text', { typography: true });
    expect(r.text).toBe('plain text');
    expect(r.applied.typography).toBe(0);
  });

  it('counts every stage in one pass', () => {
    const r = runPipeline('hello um nakilli new line bye', {
      voiceCommands: true,
      fillers: true,
      vocabularyTerms: ['Nakili'],
    });
    expect(r.text).toBe('Hello Nakili\nBye');
    expect(r.applied.voiceCommands).toBe(1);
    expect(r.applied.fillers).toBe(1);
    expect(r.applied.vocabulary).toBe(1);
  });
});
