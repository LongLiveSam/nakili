export interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const RECOVERABLE = new Set(['no-speech', 'network', 'audio-capture', 'aborted']);

type RecognitionCtor = new () => RecognitionLike;

function defaultCreateRecognition(): RecognitionLike {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) throw new Error('unsupported');
  const rec = new Ctor();
  rec.lang = navigator.language || 'en-US';
  return rec;
}

export class SpeechService {
  static isSupported(): boolean {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
  }

  onInterim: ((text: string) => void) | null = null;
  onFinal: ((text: string, elapsedSec: number) => void) | null = null;
  onError: ((err: string, fatal: boolean) => void) | null = null;

  private createRecognition: () => RecognitionLike;
  private recognition: RecognitionLike | null = null;
  private now: () => number;
  private startedAt = 0;
  stopRequested = false;

  constructor(opts: { createRecognition?: () => RecognitionLike; now?: () => number } = {}) {
    this.now = opts.now ?? (() => performance.now() / 1000);
    this.createRecognition = opts.createRecognition ?? defaultCreateRecognition;
  }

  start(): void {
    this.stopRequested = false;
    try {
      if (!this.recognition) {
        const rec = this.createRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => this.handleResult(e);
        rec.onerror = (e) => this.handleError(e.error);
        this.recognition = rec;
      }
      this.recognition.start();
    } catch {
      throw new Error('unsupported');
    }
    this.startedAt = this.now();
  }

  stop(): void {
    this.stopRequested = true;
    this.recognition?.stop();
  }

  private handleResult(e: RecognitionEventLike): void {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0]?.transcript.trim();
      if (!text) continue;
      if (result.isFinal) {
        this.onFinal?.(text, this.now() - this.startedAt);
      } else {
        this.onInterim?.(text);
      }
    }
  }

  private handleError(error: string): void {
    if (!RECOVERABLE.has(error)) {
      this.onError?.(error, true);
      return;
    }
    if (this.stopRequested || !this.recognition) return;
    try {
      this.recognition.start();
    } catch {
      this.onError?.(error, true);
    }
  }
}
