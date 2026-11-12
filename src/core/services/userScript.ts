/**
 * Optional user transform hook.
 *
 * The web counterpart of Handy's `hooks/transcription` executable: the user
 * supplies a snippet of JavaScript that receives the transcript as `text` and
 * returns the text to keep. It runs in a throwaway Worker so a runaway script
 * cannot block the UI, and it is killed after a timeout (Handy uses 30 s) with
 * the original text surviving.
 *
 * Two props from the original worth keeping:
 * - one trailing newline is removed from the output;
 * - empty output means "keep nothing", never "keep the original".
 */

export interface WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage(value: unknown): void;
  terminate(): void;
}

export type ScriptResult = { ok: true; text: string } | { ok: false; error: string };

export interface RunScriptOptions {
  timeoutMs?: number;
  createWorker?: (source: string) => WorkerLike;
}

export const SCRIPT_TIMEOUT_MS = 30_000;

/** Wrap the user's snippet in the worker message handler. */
export function buildScriptSource(script: string): string {
  const body = JSON.stringify(`"use strict"; return (async () => {\n${script}\n})();`);
  return `self.onmessage = async (event) => {
  try {
    const run = new Function("text", ${body});
    const out = await run(event.data);
    self.postMessage({ text: typeof out === "string" ? out : String(out ?? "") });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};`;
}

function createBlobWorker(source: string): WorkerLike {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  return new Worker(url) as unknown as WorkerLike;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function runUserScript(
  text: string,
  script: string,
  options: RunScriptOptions = {},
): Promise<ScriptResult> {
  if (!script.trim()) return Promise.resolve({ ok: true, text });

  let worker: WorkerLike;
  try {
    worker = (options.createWorker ?? createBlobWorker)(buildScriptSource(script));
  } catch (err) {
    return Promise.resolve({ ok: false, error: messageOf(err) });
  }

  return new Promise<ScriptResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: ScriptResult) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };

    timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), options.timeoutMs ?? SCRIPT_TIMEOUT_MS);
    worker.onmessage = (event) => {
      const data = event.data as { text?: unknown; error?: unknown } | null;
      if (data && typeof data.error === 'string') {
        finish({ ok: false, error: data.error });
        return;
      }
      const out = typeof data?.text === 'string' ? data.text : '';
      finish({ ok: true, text: out.replace(/\n$/, '') });
    };
    worker.onerror = () => finish({ ok: false, error: 'script failed' });
    worker.postMessage(text);
  });
}
