import { describe, it, expect, vi, afterEach } from 'vitest';
import { runUserScript, buildScriptSource, type WorkerLike } from './userScript';

/** Minimal worker double: replies as soon as the implementation posts a message. */
function fakeWorker(
  handler: (msg: unknown, reply: (data: unknown) => void) => void,
  options: { failOnStart?: boolean } = {},
) {
  const worker = {
    onmessage: null as ((e: { data: unknown }) => void) | null,
    onerror: null as ((e: unknown) => void) | null,
    terminate: vi.fn(),
    postMessage: vi.fn((msg: unknown) => {
      handler(msg, (data) => worker.onmessage?.({ data }));
    }),
  } as unknown as WorkerLike;
  return { worker, createWorker: () => { if (options.failOnStart) throw new Error('no workers'); return worker; } };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('buildScriptSource', () => {
  it('embeds the user script and posts a text result back', () => {
    const src = buildScriptSource('return text + "!";');
    expect(src).toContain('self.onmessage');
    expect(src).toContain('return text');
    expect(src).toContain('postMessage');
  });
});

describe('runUserScript', () => {
  it('returns the script output', async () => {
    const { createWorker } = fakeWorker((msg, reply) => reply({ text: `${msg} ok` }));
    await expect(runUserScript('hi', 'return text;', { createWorker }))
      .resolves.toEqual({ ok: true, text: 'hi ok' });
  });

  it('strips exactly one trailing newline', async () => {
    const { createWorker } = fakeWorker((_msg, reply) => reply({ text: 'lined\n\n' }));
    await expect(runUserScript('x', 'return text;', { createWorker }))
      .resolves.toEqual({ ok: true, text: 'lined\n' });
  });

  it('returns an empty result when the script yields nothing', async () => {
    const { createWorker } = fakeWorker((_msg, reply) => reply({ text: '' }));
    await expect(runUserScript('x', 'return "";', { createWorker }))
      .resolves.toEqual({ ok: true, text: '' });
  });

  it('surfaces script errors', async () => {
    const { createWorker } = fakeWorker((_msg, reply) => reply({ error: 'boom' }));
    await expect(runUserScript('x', 'throw new Error("boom")', { createWorker }))
      .resolves.toEqual({ ok: false, error: 'boom' });
  });

  it('reports a worker start failure instead of throwing', async () => {
    const { createWorker } = fakeWorker(() => {}, { failOnStart: true });
    await expect(runUserScript('x', 'return text;', { createWorker }))
      .resolves.toEqual({ ok: false, error: 'no workers' });
  });

  it('times out after the configured budget and terminates the worker', async () => {
    vi.useFakeTimers();
    const { worker, createWorker } = fakeWorker(() => {});
    const pending = runUserScript('x', 'return text;', { createWorker, timeoutMs: 30000 });
    await vi.advanceTimersByTimeAsync(30000);
    await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('passes the transcript straight through when no script is configured', async () => {
    await expect(runUserScript('keep me', '   ')).resolves.toEqual({ ok: true, text: 'keep me' });
  });
});
