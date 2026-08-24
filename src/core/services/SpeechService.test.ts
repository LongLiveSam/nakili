import { describe, it, expect, vi } from 'vitest';
import { SpeechService, type RecognitionLike, type RecognitionEventLike } from './SpeechService';

function makeFakeRecognition() {
  const rec: RecognitionLike = {
    lang: '', continuous: false, interimResults: false,
    start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    onresult: null, onerror: null, onend: null,
  };
  return rec;
}

function resultEvent(items: Array<{ text: string; isFinal: boolean }>): RecognitionEventLike {
  const results = items.map((i) => Object.assign([{ transcript: i.text }], { isFinal: i.isFinal }));
  return { resultIndex: 0, results: results as never };
}

let clock = 1000;

describe('SpeechService', () => {
  it('emits interim and final results with elapsed time', () => {
    const rec = makeFakeRecognition();
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    const interims: string[] = [];
    const finals: Array<[string, number]> = [];
    svc.onInterim = (t) => interims.push(t);
    svc.onFinal = (t, e) => finals.push([t, e]);

    svc.start();
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(rec.start).toHaveBeenCalledTimes(1);

    rec.onresult!(resultEvent([{ text: 'hel', isFinal: false }]));
    expect(interims).toEqual(['hel']);

    clock = 1002.5;
    rec.onresult!(resultEvent([{ text: 'hello', isFinal: true }]));
    expect(finals).toEqual([['hello', 2.5]]);
  });

  it('restarts after recoverable errors unless stopped', () => {
    const rec = makeFakeRecognition();
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    svc.start();
    (rec.start as ReturnType<typeof vi.fn>).mockClear();

    rec.onerror!({ error: 'no-speech' });
    expect(rec.start).toHaveBeenCalledTimes(1);

    svc.stop();
    expect(svc.stopRequested).toBe(true);
    rec.onerror!({ error: 'network' });
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it('reports fatal errors without restarting', () => {
    const rec = makeFakeRecognition();
    const errors: Array<[string, boolean]> = [];
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    svc.onError = (e, fatal) => errors.push([e, fatal]);
    svc.start();
    rec.onerror!({ error: 'not-allowed' });
    expect(errors).toEqual([['not-allowed', true]]);
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it('throws on unsupported environment', () => {
    const svc = new SpeechService({
      createRecognition: () => { throw new Error('unsupported'); },
      now: () => clock,
    });
    expect(() => svc.start()).toThrow(/unsupported/i);
  });
});
