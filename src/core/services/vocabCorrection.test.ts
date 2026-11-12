import { describe, it, expect } from 'vitest';
import { applyVocabulary, soundex } from './vocabCorrection';

const TERMS = ['Nakili', 'Kubernetes', 'ChargeBee'];

describe('soundex', () => {
  it('encodes standard American Soundex', () => {
    expect(soundex('Robert')).toBe('R163');
    expect(soundex('Rupert')).toBe('R163');
    expect(soundex('Tymczak')).toBe('T522');
  });

  it('drops adjacent duplicate codes and treats vowels as separators', () => {
    expect(soundex('Ashcraft')).toBe('A261');
    expect(soundex('Pfister')).toBe('P236');
  });

  it('returns an empty string for input with no ASCII letters', () => {
    expect(soundex('123')).toBe('');
    expect(soundex('東京')).toBe('');
  });
});

describe('applyVocabulary', () => {
  it('leaves text untouched when there are no terms', () => {
    const r = applyVocabulary('I use nakilli daily', []);
    expect(r.text).toBe('I use nakilli daily');
    expect(r.corrections).toEqual([]);
  });

  it('leaves already-correct terms alone', () => {
    const r = applyVocabulary('Nakili runs on Kubernetes with ChargeBee', TERMS);
    expect(r.text).toBe('Nakili runs on Kubernetes with ChargeBee');
    expect(r.corrections).toEqual([]);
  });

  it('repairs a near miss and reports the correction', () => {
    const r = applyVocabulary('I use nakilli every day', TERMS);
    expect(r.text).toBe('I use Nakili every day');
    expect(r.corrections).toHaveLength(1);
    expect(r.corrections[0]).toMatchObject({ from: 'nakilli', to: 'Nakili' });
    expect(r.corrections[0].score).toBeLessThan(0.18);
  });

  it('preserves surrounding punctuation', () => {
    const r = applyVocabulary('try nakilli, then ship.', TERMS);
    expect(r.text).toBe('try Nakili, then ship.');
  });

  it('preserves newlines, tabs, and repeated spaces', () => {
    const input = 'use nakilli\n\n  then  stop';
    const r = applyVocabulary(input, TERMS);
    expect(r.text).toBe('use Nakili\n\n  then  stop');
  });

  it('joins split words for multi-word mishearings', () => {
    const r = applyVocabulary('we shipped charge b last week', TERMS);
    expect(r.text).toBe('we shipped ChargeBee last week');
    expect(r.corrections[0]).toMatchObject({ from: 'charge b', to: 'ChargeBee' });
  });

  it('does not consume a word across a punctuation boundary', () => {
    const r = applyVocabulary('charge, b is next', TERMS);
    expect(r.text).toBe('charge, b is next');
  });

  it('applies a phonetic boost when edit distance is close but over threshold', () => {
    const r = applyVocabulary('kubernitis is hard', TERMS);
    expect(r.text).toBe('Kubernetes is hard');
  });

  it('rejects words that are too distant', () => {
    const r = applyVocabulary('a kangaroo hopped by', TERMS);
    expect(r.text).toBe('a kangaroo hopped by');
  });

  it('refuses to match candidates with wildly different lengths', () => {
    const r = applyVocabulary('openai shipped it', TERMS);
    expect(r.text).toBe('openai shipped it');
  });

  it('honours a stricter threshold', () => {
    const loose = applyVocabulary('nakilly', TERMS);
    const strict = applyVocabulary('nakilly', TERMS, { threshold: 0.05 });
    expect(loose.text).toBe('Nakili');
    expect(strict.text).toBe('nakilly');
  });

  it('preserves ALL CAPS and capitalised case patterns', () => {
    expect(applyVocabulary('NAKILLI', TERMS).text).toBe('NAKILI');
    expect(applyVocabulary('Nakilli', TERMS).text).toBe('Nakili');
  });

  it('skips non-ASCII terms instead of fuzzy-matching them', () => {
    const r = applyVocabulary('munchen is nice', ['München']);
    expect(r.text).toBe('munchen is nice');
  });

  it('never matches an empty candidate', () => {
    const r = applyVocabulary('!!! ???', TERMS);
    expect(r.text).toBe('!!! ???');
  });
});
