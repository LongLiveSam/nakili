export interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  grammars?: unknown;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const RECOVERABLE = new Set(['no-speech', 'network', 'audio-capture', 'aborted']);

type RecognitionCtor = new () => RecognitionLike;

interface GrammarListLike {
  addFromString(grammar: string, weight?: number): void;
}

function defaultCreateRecognition(): RecognitionLike {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) throw new Error('unsupported');
  const rec = new Ctor();
  rec.lang = navigator.language || 'en-US';
  // User-selected recognition language (Settings) overrides browser default.
  try {
    const stored = localStorage.getItem('nakili-lang');
    if (stored) rec.lang = stored;
  } catch {
    /* storage unavailable */
  }
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
  private schedule: (ms: number, cb: () => void) => void;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private pendingRestart = false;
  private restartError: string | null = null;
  private vocabulary: string[] = [];
  private nextDelayMs = 0;
  private lastInterimAt = -1;
  private pendingInterim = '';
  stopRequested = false;

  constructor(
    opts: {
      createRecognition?: () => RecognitionLike;
      now?: () => number;
      schedule?: (ms: number, cb: () => void) => void;
    } = {},
  ) {
    this.now = opts.now ?? (() => performance.now() / 1000);
    // Injectable for tests; production uses a real 300–1500 ms backoff.
    this.schedule =
      opts.schedule ??
      ((ms, cb) => {
        window.setTimeout(cb, ms);
      });
    this.createRecognition = opts.createRecognition ?? defaultCreateRecognition;
  }

  /** Custom terms handed to the recognizer via SpeechGrammarList when supported. */
  setVocabulary(words: string[]): void {
    this.vocabulary = words.map((w) => w.trim()).filter(Boolean);
    if (this.recognition) this.applyVocabulary(this.recognition);
  }

  private applyVocabulary(rec: RecognitionLike): void {
    if (this.vocabulary.length === 0) return;
    const w = window as unknown as { SpeechGrammarList?: new () => GrammarListLike; webkitSpeechGrammarList?: new () => GrammarListLike };
    const Ctor = w.SpeechGrammarList ?? w.webkitSpeechGrammarList;
    if (!Ctor) return; // best-effort only; engine may ignore
    try {
      const terms = this.vocabulary.map((t) => `"${t.replace(/[";]/g, '')}"`).join(' | ');
      const grammar = `#JSGF V1.0; grammar nakili; public <terms> = ${terms} ;`;
      const list = new Ctor();
      list.addFromString(grammar, 1);
      rec.grammars = list;
    } catch {
      /* grammar construction is optional */
    }
  }

  start(): void {
    this.stopRequested = false;
    this.pendingRestart = false;
    this.restartError = null;
    if (!this.recognition) {
      try {
        this.recognition = this.buildRecognition();
      } catch (err) {
        if (err instanceof Error) throw err;
        throw new Error('unsupported');
      }
    }
    this.applyVocabulary(this.recognition);
    try {
      this.recognition.start();
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('speech-recognition-failed-to-start');
    }
    this.startedAt = this.now();
    this.pausedAt = 0;
    this.pausedTotal = 0;
  }

  stop(): void {
    this.stopRequested = true;
    this.pendingRestart = false;
    this.restartError = null;
    this.recognition?.stop();
  }

  /** Soft pause: stop recognition and freeze the timeline. */
  pause(): void {
    if (!this.recognition) return;
    this.paused = true;
    this.pausedAt = this.now();
    this.pendingRestart = false;
    try { this.recognition.stop(); } catch { /* ignore */ }
  }

  /** Resume after pause(): restart recognition and continue the audio clock. */
  resume(): void {
    if (!this.paused || !this.recognition) return;
    this.paused = false;
    if (this.pausedAt > 0) {
      this.pausedTotal += this.now() - this.pausedAt;
      this.pausedAt = 0;
    }
    try { this.recognition.start(); } catch { /* already running */ }
  }

  /** Seconds of speech time, excluding user pauses. */
  private elapsed(): number {
    const t = this.now();
    const pausedNow = this.pausedAt > 0 ? t - this.pausedAt : 0;
    return t - this.startedAt - this.pausedTotal - pausedNow;
  }

  private paused = false;

  private buildRecognition(): RecognitionLike {
    const rec = this.createRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => this.handleResult(e);
    rec.onerror = (e) => this.handleError(e.error);
    rec.onend = () => this.handleEnd();
    return rec;
  }

  private handleResult(e: RecognitionEventLike): void {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0]?.transcript.trim();
      if (!text) continue;
      if (result.isFinal) {
        this.pendingInterim = '';
        this.onFinal?.(text, this.elapsed());
      } else {
        // Throttle interim renders to ~7/s — the final always supersedes.
        const t = this.now();
        this.pendingInterim = text;
        if (this.lastInterimAt < 0 || t - this.lastInterimAt >= 0.15) {
          this.lastInterimAt = t;
          this.onInterim?.(this.pendingInterim);
        }
      }
    }
  }

  private handleError(error: string): void {
    if (!RECOVERABLE.has(error)) {
      this.onError?.(error, true);
      return;
    }
    if (this.stopRequested) return;
    this.pendingRestart = true;
    this.restartError = error;
    // Backoff: network hiccups need a longer breath than a mere no-speech.
    this.nextDelayMs = error === 'network' ? 1500 : 300;
  }

  private handleEnd(): void {
    if (this.paused) return; // user-initiated pause — stay stopped
    if (!this.pendingRestart || !this.recognition) return;
    this.pendingRestart = false;
    const error = this.restartError ?? 'unknown';
    const delayMs = this.nextDelayMs;
    this.restartError = null;
    const attempt = () => {
      try {
        this.recognition!.start();
      } catch {
        this.onError?.(error, true);
      }
    };
    if (delayMs > 0) {
      this.schedule(delayMs, attempt);
    } else {
      attempt();
    }
  }
}
