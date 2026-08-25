import { CHUNK_SECONDS } from './MappingService';

export interface MediaRecorderLike {
  start(): void;
  stop(): void;
  state: 'inactive' | 'recording';
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
}

export class RecorderService {
  onError: ((message: string) => void) | null = null;

  private getUserMedia: () => Promise<MediaStream>;
  private createRecorder: (stream: MediaStream) => MediaRecorderLike;
  private setIntervalFn: typeof setInterval;
  private clearIntervalFn: typeof clearInterval;

  private stream: MediaStream | null = null;
  private recorder: MediaRecorderLike | null = null;
  private chunks: RecordedChunk[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private running = false;
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

  start(): void {
    if (!this.stream) throw new Error('microphone not acquired: call requestMicrophone() first');
    this.chunks = [];
    this.running = true;
    this.beginChunk(0);
    this.timerId = this.setIntervalFn(() => this.rollOver(), CHUNK_SECONDS * 1000);
  }

  async stop(): Promise<RecordedChunk[]> {
    if (!this.running) return [];
    this.running = false;
    if (this.timerId !== null) {
      this.clearIntervalFn(this.timerId);
      this.timerId = null;
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

  private beginChunk(index: number): void {
    this.recorder = this.createRecorder(this.stream!);
    const startedAtMs = Date.now();
    this.recorder.onerror = () => {
      this.onError?.('Recording error');
    };
    this.recorder.ondataavailable = (e) => {
      this.chunks.push({
        index,
        blob: e.data,
        startTimeSec: index * CHUNK_SECONDS,
        durationSec: (Date.now() - startedAtMs) / 1000,
      });
    };
    this.recorder.start();
  }

  /**
   * Rollover: the flushing chunk pushes itself via ondataavailable during
   * .stop() (fires synchronously before onstop), occupying slot `chunks.length`
   * at call time. The next chunk therefore begins at chunks.length (post-flush)
   * which equals pre-flush length + 1.
   */
  private rollOver(): void {
    if (!this.running || !this.recorder) return;
    const current = this.recorder;
    const nextIndex = this.chunks.length + 1;
    current.onstop = () => {
      current.onstop = null;
      if (this.running) this.beginChunk(nextIndex);
    };
    current.stop();
  }

  private finishCurrentChunk(): Promise<void> {
    const current = this.recorder;
    if (!current || current.state === 'inactive') return Promise.resolve();
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
