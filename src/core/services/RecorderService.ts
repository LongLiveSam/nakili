import { CHUNK_SECONDS } from './MappingService';

export interface MediaRecorderLike {
  start(): void;
  stop(): void;
  state: 'inactive' | 'recording';
  pause?(): void;
  resume?(): void;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: { error?: unknown }) => void) | null;
}

export interface RecordedChunk {
  index: number;
  blob: Blob;
  startTimeSec: number;
  durationSec: number;
}

interface RecorderDeps {
  getUserMedia?: () => Promise<MediaStream>;
  createRecorder?: (stream: MediaStream) => MediaRecorderLike;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  now?: () => number;
}

export class RecorderService {
  onError: ((message: string) => void) | null = null;

  private getUserMedia: () => Promise<MediaStream>;
  private createRecorder: (stream: MediaStream) => MediaRecorderLike;
  private setIntervalFn: typeof setInterval;
  private clearIntervalFn: typeof clearInterval;
  private now: () => number;

  private stream: MediaStream | null = null;
  private recorder: MediaRecorderLike | null = null;
  private chunks: RecordedChunk[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private paused = false;
  private indexBase = 0;
  private startOffsetSec = 0;
  /** Recorded seconds so far — pauses are excluded, so this is the audio clock. */
  private recordedSec = 0;
  private chunkStartedAtMs = 0;
  private pendingStop: Promise<void> | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor(deps: RecorderDeps = {}) {
    this.getUserMedia =
      deps.getUserMedia ??
      (() =>
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000, // hint only — browsers override when unsupported
          },
        }));
    this.createRecorder =
      deps.createRecorder ??
      ((stream) => {
        // Prefer AAC/MP4 (wide compatibility), then WebM/Opus, then browser default.
        const preferred = ['audio/mp4', 'audio/webm;codecs=opus'];
        const mimeType =
          typeof MediaRecorder !== 'undefined'
            ? preferred.find((t) => MediaRecorder.isTypeSupported(t))
            : undefined;
        try {
          return new MediaRecorder(stream, mimeType ? { mimeType } : undefined) as unknown as MediaRecorderLike;
        } catch {
          return new MediaRecorder(stream) as unknown as MediaRecorderLike;
        }
      });
    this.setIntervalFn = deps.setInterval ?? setInterval.bind(globalThis);
    this.clearIntervalFn = deps.clearInterval ?? clearInterval.bind(globalThis);
    this.now = deps.now ?? (() => Date.now());
  }

  async requestMicrophone(): Promise<void> {
    this.stream = await this.getUserMedia();
    // Level meter tap (instrument widget on the recording screen).
    try {
      this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
    } catch {
      this.analyser = null;
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  start(opts: { startIndex?: number; startOffsetSec?: number } = {}): void {
    if (!this.stream) throw new Error('microphone not acquired: call requestMicrophone() first');
    this.chunks = [];
    this.indexBase = opts.startIndex ?? 0;
    this.startOffsetSec = opts.startOffsetSec ?? 0;
    this.recordedSec = 0;
    this.running = true;
    this.paused = false;
    this.pendingStop = null;
    this.beginChunk(this.indexBase);
    this.startTimer();
  }

  async stop(): Promise<RecordedChunk[]> {
    if (!this.running) return [];
    this.running = false;
    this.clearTimer();
    if (this.pendingStop) {
      await this.pendingStop;
      this.pendingStop = null;
    }
    await this.finishCurrentChunk();
    this.recorder = null;
    return [...this.chunks];
  }

  releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }

  /**
   * Pause-aligned chunking: the current clip is closed at the pause point and
   * the next one starts on resume. Paused time therefore never enters the audio
   * timeline, so clip offsets and transcript timestamps stay aligned.
   */
  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.clearTimer();
    this.pendingStop = this.finishCurrentChunk();
  }

  async resume(): Promise<void> {
    if (!this.paused || !this.running) return;
    if (this.pendingStop) {
      await this.pendingStop;
      this.pendingStop = null;
    }
    if (!this.running) return;
    this.paused = false;
    this.beginChunk(this.indexBase + this.chunks.length);
    this.startTimer();
  }

  private startTimer(): void {
    this.clearTimer();
    this.timerId = this.setIntervalFn(() => this.rollOver(), CHUNK_SECONDS * 1000);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      this.clearIntervalFn(this.timerId);
      this.timerId = null;
    }
  }

  private beginChunk(index: number): void {
    const rec = this.createRecorder(this.stream!);
    this.recorder = rec;
    this.chunkStartedAtMs = this.now();
    const startTimeSec = this.startOffsetSec + this.recordedSec;
    rec.onerror = () => {
      this.onError?.('Recording error');
    };
    rec.ondataavailable = (e) => {
      const durationSec = Math.max(0, (this.now() - this.chunkStartedAtMs) / 1000);
      this.chunks.push({ index, blob: e.data, startTimeSec, durationSec });
      this.recordedSec += durationSec;
    };
    rec.start();
  }

  /**
   * Rollover: the flushing chunk pushes itself via ondataavailable during
   * .stop() (fires synchronously before onstop), so `recordedSec` is already
   * updated when the next chunk begins.
   */
  private rollOver(): void {
    if (!this.running || this.paused || !this.recorder) return;
    const current = this.recorder;
    const nextIndex = this.indexBase + this.chunks.length + 1;
    current.onstop = () => {
      current.onstop = null;
      if (this.running && !this.paused) this.beginChunk(nextIndex);
    };
    current.stop();
  }

  private finishCurrentChunk(): Promise<void> {
    const current = this.recorder;
    if (!current || current.state === 'inactive') return Promise.resolve();
    this.recorder = null;
    return new Promise<void>((resolve) => {
      const prevOnStop = current.onstop;
      current.onstop = () => {
        prevOnStop?.();
        resolve();
      };
      current.stop();
    });
  }
}
