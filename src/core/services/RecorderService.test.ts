import { describe, it, expect, vi } from 'vitest';
import { RecorderService, type MediaRecorderLike } from './RecorderService';

let blobSeq = 0;

function makeFakeRecorder() {
  const rec: MediaRecorderLike = {
    state: 'inactive',
    start: vi.fn(() => { rec.state = 'recording'; }),
    stop: vi.fn(() => {
      rec.state = 'inactive';
      queueMicrotask(() => {
        rec.ondataavailable?.({ data: new Blob([`blob${++blobSeq}`]) });
        rec.onstop?.();
      });
    }),
    ondataavailable: null,
    onstop: null,
  };
  return rec;
}

/** Interval callbacks registered but only fired manually by tickAll(). */
function makeManualTimers() {
  const callbacks = new Map<number, () => void>();
  let nextId = 1;
  const setInterval = ((cb: () => void) => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id as unknown as ReturnType<typeof globalThis.setInterval>;
  }) as unknown as typeof globalThis.setInterval;
  const clearInterval = ((id: number) => {
    callbacks.delete(id as number);
  }) as typeof globalThis.clearInterval;
  return { setInterval, clearInterval, tickAll: () => [...callbacks.values()].forEach((cb) => cb()) };
}

async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('RecorderService', () => {
  it('rolls over to a fresh recorder each interval and yields ordered chunks', async () => {
    blobSeq = 0;
    const timers = makeManualTimers();
    const created: MediaRecorderLike[] = [];
    const svc = new RecorderService({
      getUserMedia: async () => ({}) as MediaStream,
      createRecorder: () => { const r = makeFakeRecorder(); created.push(r); return r; },
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    });
    await svc.requestMicrophone();
    svc.start();
    expect(created.length).toBe(1);

    timers.tickAll(); // one 30 s boundary elapses
    await flush();
    expect(created.length).toBe(2);
    expect(created[0].state).toBe('inactive');
    expect(created[1].state).toBe('recording');

    const chunks = await svc.stop();
    await flush();
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    expect(chunks.map((c) => c.startTimeSec)).toEqual([0, 30]);
    expect(chunks[0].blob.size).toBeGreaterThan(0);
    expect(chunks[1].blob.size).toBeGreaterThan(0);
  });

  it('does not roll over after stop', async () => {
    blobSeq = 0;
    const timers = makeManualTimers();
    const created: MediaRecorderLike[] = [];
    const svc = new RecorderService({
      getUserMedia: async () => ({}) as MediaStream,
      createRecorder: () => { const r = makeFakeRecorder(); created.push(r); return r; },
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    });
    await svc.requestMicrophone();
    svc.start();
    await svc.stop();
    const countBefore = created.length;
    timers.tickAll();
    await flush();
    expect(created.length).toBe(countBefore);
  });

  it('stop without start resolves empty', async () => {
    const svc = new RecorderService({});
    expect(await svc.stop()).toEqual([]);
  });

  it('start without microphone throws actionable error', () => {
    const svc = new RecorderService({});
    expect(() => svc.start()).toThrow(/microphone/i);
  });
});
