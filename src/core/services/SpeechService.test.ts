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

/** Service whose scheduled restarts run synchronously and record their delays. */
function makeSyncSvc(rec: RecognitionLike, delays: number[], now: () => number = () => clock) {
  const svc = new SpeechService({
    createRecognition: () => rec,
    now,
    schedule: (ms, cb) => { delays.push(ms); cb(); },
  });
  return svc;
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

  it('throttles interim callbacks to ~7/s but always emits finals', () => {
    const rec = makeFakeRecognition();
    let t = 1000;
    const svc = new SpeechService({ createRecognition: () => rec, now: () => t });
    const interims: string[] = [];
    const finals: string[] = [];
    svc.onInterim = (x) => interims.push(x);
    svc.onFinal = (x) => finals.push(x);

    svc.start();
    rec.onresult!(resultEvent([{ text: 'a', isFinal: false }]));
    t += 0.05;
    rec.onresult!(resultEvent([{ text: 'ab', isFinal: false }])); // inside window — held
    t += 0.05;
    rec.onresult!(resultEvent([{ text: 'abc', isFinal: false }])); // still inside
    expect(interims).toEqual(['a']);

    t += 0.2;
    rec.onresult!(resultEvent([{ text: 'abcd', isFinal: true }]));
    expect(interims).toEqual(['a']);
    expect(finals).toEqual(['abcd']);
  });

  it('restarts after recoverable errors unless stopped', () => {
    clock = 1000;
    const rec = makeFakeRecognition();
    const delays: number[] = [];
    const svc = makeSyncSvc(rec, delays);
    svc.start();
    (rec.start as ReturnType<typeof vi.fn>).mockClear();

    rec.onerror!({ error: 'no-speech' });
    expect(rec.start).not.toHaveBeenCalled();

    rec.onend!();
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([300]); // brief pause for flaky engines

    svc.stop();
    expect(svc.stopRequested).toBe(true);
    rec.onerror!({ error: 'network' });
    rec.onend!();
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it('backs off longer after network errors', () => {
    clock = 1000;
    const rec = makeFakeRecognition();
    const delays: number[] = [];
    const svc = makeSyncSvc(rec, delays);
    svc.start();
    (rec.start as ReturnType<typeof vi.fn>).mockClear();

    rec.onerror!({ error: 'network' });
    rec.onend!();
    expect(delays).toEqual([1500]);
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

  it('keeps elapsed time across automatic restarts', () => {
    clock = 2000;
    const rec = makeFakeRecognition();
    const svc = makeSyncSvc(rec, [], () => clock);
    const finals: Array<[string, number]> = [];
    svc.onFinal = (t, e) => finals.push([t, e]);
    svc.start();

    rec.onerror!({ error: 'no-speech' });
    rec.onend!();
    clock = 2003.25;
    rec.onresult!(resultEvent([{ text: 'resumed', isFinal: true }]));
    expect(finals).toEqual([['resumed', 3.25]]);
  });

  it('reports a fatal error when the onend restart attempt fails', () => {
    const rec = makeFakeRecognition();
    let starts = 0;
    (rec.start as ReturnType<typeof vi.fn>).mockImplementation(() => {
      starts++;
      if (starts > 1) throw new Error('InvalidStateError');
    });
    const errors: Array<[string, boolean]> = [];
    const svc = makeSyncSvc(rec, []);
    svc.onError = (e, fatal) => errors.push([e, fatal]);
    svc.start();

    rec.onerror!({ error: 'audio-capture' });
    rec.onend!();
    expect(errors).toEqual([['audio-capture', true]]);
    expect(rec.start).toHaveBeenCalledTimes(2);
  });

  it('handles stop before start', () => {
    const rec = makeFakeRecognition();
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    expect(() => svc.stop()).not.toThrow();
    expect(svc.stopRequested).toBe(true);

    svc.start();
    expect(svc.stopRequested).toBe(false);
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it('retries construction after a failed attempt and preserves its error', () => {
    let attempts = 0;
    const rec = makeFakeRecognition();
    const svc = new SpeechService({
      createRecognition: () => {
        attempts++;
        if (attempts === 1) throw new Error('boom');
        return rec;
      },
      now: () => clock,
    });

    expect(() => svc.start()).toThrow('boom');

    svc.start();
    expect(attempts).toBe(2);
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(svc.stopRequested).toBe(false);
  });

  it('preserves the identity of engine start failures', () => {
    const rec = makeFakeRecognition();
    (rec.start as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('InvalidStateError');
    });
    const svc = new SpeechService({ createRecognition: () => rec, now: () => clock });
    expect(() => svc.start()).toThrow(/InvalidStateError/);
  });

  it('normalizes non-Error construction throws to unsupported', () => {
    const svc = new SpeechService({
      createRecognition: () => { throw 'no-api'; },
      now: () => clock,
    });
    expect(() => svc.start()).toThrow(/unsupported/i);
  });
});
