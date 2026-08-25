import { create } from 'zustand';
import { SpeechService } from '../../core/services/SpeechService';
import { RecorderService } from '../../core/services/RecorderService';
import {
  buildTranscript, type FinalResult,
} from '../../core/services/MappingService';
import { adjustSegmentsAfterEdit } from '../../core/services/MappingService';
import { applyVoiceCommands, planParagraphBreaks } from '../../core/services/formatting';
import {
  saveSessionAudio, putArticle, getArticle, putSegments, getChunks,
} from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';
import type { TranscriptSegment } from '../../core/models';

function featureOn(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

let speech: SpeechService | null = null;
let recorder: RecorderService | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let startedAtMs = 0;
let currentDraftId: string | null = null;
let silenceTicks = 0;
let lastBreakSec = -30;
const boundariesSec: number[] = [];
interface AppendBase { timeBase: number; indexBase: number; prevLen: number }
let appendBase: AppendBase | null = null;
let wakeLockSentinel: { release(): Promise<void> } | null = null;

function releaseWakeLock(): void {
  try { void wakeLockSentinel?.release(); } catch { /* ignore */ }
  wakeLockSentinel = null;
}

/** Test seam: inject fakes instead of constructing real browser services. */
export function __setServicesForTest(s: SpeechService, r: RecorderService): void {
  speech = s;
  recorder = r;
}

/** Live mic analyser for the level meter (null when not recording). */
export function getActiveAnalyser(): AnalyserNode | null {
  return recorder?.getAnalyser?.() ?? null;
}

function loadVocabulary(): string[] {
  try {
    return localStorage
      .getItem('nakili-vocab')
      ?.split('\n')
      .map((w) => w.trim())
      .filter(Boolean) ?? [];
  } catch {
    return [];
  }
}

function makeServices(): void {
  speech = new SpeechService();
  speech.setVocabulary(loadVocabulary());
  recorder = new RecorderService();
}

interface RecordingState {
  status: 'idle' | 'recording';
  paused: boolean;
  elapsedSec: number;
  interimText: string;
  finals: FinalResult[];
  errorMessage: string | null;
  recorderNotice: string | null;
  start: () => Promise<void>;
  restartText: () => void;
  pauseToggle: () => void;
  stopAndSave: (articleId: string) => Promise<void>;
}

function draftKey(articleId: string): string {
  return `nakili-draft-${articleId}`;
}

/** Persist finals as a crash-recovery point (best-effort). */
function saveDraft(articleId: string, finals: FinalResult[]): void {
  try {
    localStorage.setItem(draftKey(articleId), JSON.stringify(finals));
  } catch {
    /* storage unavailable */
  }
}

function loadDraft(articleId: string): FinalResult[] {
  try {
    const raw = localStorage.getItem(draftKey(articleId));
    return raw ? (JSON.parse(raw) as FinalResult[]) : [];
  } catch {
    return [];
  }
}

function clearDraft(articleId: string): void {
  try {
    localStorage.removeItem(draftKey(articleId));
  } catch {
    /* ignore */
  }
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  status: 'idle',
  paused: false,
  elapsedSec: 0,
  interimText: '',
  finals: [],
  errorMessage: null,
  recorderNotice: null,

  start: async () => {
    if (get().status === 'recording') return;
    // Claim 'recording' synchronously so StrictMode double-effects cannot
    // double-start services before the first await resolves.
    set({
      status: 'recording',
      errorMessage: null,
      recorderNotice: null,
      finals: [],
      interimText: '',
      elapsedSec: 0,
    });
    const st = useAppStore.getState();
    const draftId = st.activeArticleId;
    const appending = st.appendMode && !!draftId;
    let timeBase = 0;
    let indexBase = 0;
    let prevText = '';
    if (appending && draftId) {
      currentDraftId = draftId;
      timeBase = (await getArticle(draftId))?.durationSec ?? 0;
      const chunks = await getChunks(draftId);
      indexBase = chunks.length > 0 ? Math.max(...chunks.map((c) => c.index)) + 1 : 0;
      prevText = (await getArticle(draftId))?.transcriptText ?? '';
      appendBase = { timeBase, indexBase, prevLen: prevText.length };
      // Resume the clock where the previous session ended.
      set({ elapsedSec: timeBase });
      const draft = loadDraft(draftId);
      if (draft.length > 0) set({ finals: draft });
    } else {
      appendBase = null;
      currentDraftId = draftId ?? null;
    }
    if (!speech || !recorder) makeServices();
    try {
      await recorder!.requestMicrophone();
    } catch {
      set({
        status: 'idle',
        errorMessage:
          '[ERROR: MICROPHONE ACCESS DENIED — ALLOW MIC FOR THIS SITE IN BROWSER SETTINGS, THEN RETRY]',
      });
      speech = null;
      recorder = null;
      return;
    }
    speech!.onInterim = (t) => set({ interimText: t });
    const voiceCmds = featureOn('nakili-voice-cmds');
    const tb = () => appendBase?.timeBase ?? 0;
    speech!.onFinal = (rawText, elapsedSec) =>
      set((s) => {
        const text = voiceCmds ? applyVoiceCommands(rawText).text : rawText;
        if (!text) return { interimText: '' } as Partial<RecordingState>;
        const abs = elapsedSec + tb();
        const last = s.finals[s.finals.length - 1];
        // Merge into the previous final when a command collapsed it to punctuation.
        const finals =
          last && /^[,.!?]$/.test(text)
            ? [...s.finals.slice(0, -1), { ...last, text: last.text + text }]
            : [...s.finals, { text, startTimeSec: abs, endTimeSec: abs }];
        // Crash-recovery point: persist every confirmed phrase.
        if (currentDraftId) saveDraft(currentDraftId, finals);
        return { finals, interimText: '' } as Partial<RecordingState>;
      });
    speech!.onError = (err, fatal) => {
      if (fatal) {
        set({ errorMessage: `[ERROR: SPEECH RECOGNITION ${err.toUpperCase()} — AUDIO KEEPS RECORDING, LIVE TEXT PAUSED]` });
      }
    };
    recorder!.onError = () => {
      set({ recorderNotice: '[NOTICE: AUDIO RECORDING ERROR — CAPTURED AUDIO IS KEPT]' });
    };
    recorder!.start({ startIndex: appendBase?.indexBase ?? 0 });
    speech!.start();
    startedAtMs = Date.now();
    void (navigator as Navigator & { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } })
      .wakeLock?.request('screen')
      .then((wl) => { wakeLockSentinel = wl; })
      .catch(() => {});
    // Prosody: watch the level meter feed for ~0.9 s silences → paragraph hints.
    silenceTicks = 0;
    lastBreakSec = -30;
    ticker = setInterval(() => {
      set((s) => {
        const elapsedSec = s.elapsedSec + 0.25;
        const an = getActiveAnalyser();
        if (an) {
          const data = new Uint8Array(an.frequencyBinCount);
          an.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const level = sum / data.length;
          if (level < 10) {
            silenceTicks++;
            if (silenceTicks * 0.25 >= 0.9 && elapsedSec - lastBreakSec >= 25) {
              boundariesSec.push(elapsedSec);
              lastBreakSec = elapsedSec;
              silenceTicks = 0;
            }
          } else {
            silenceTicks = 0;
          }
        }
        return { elapsedSec };
      });
    }, 250);
    set({ status: 'recording' });
  },

  restartText: () => {
    if (get().status !== 'recording') return;
    speech?.resume();
  },

  pauseToggle: () => {
    const s = get();
    if (s.status !== 'recording') return;
    if (!s.paused) {
      if (ticker) { clearInterval(ticker); ticker = null; }
      speech?.pause();
      recorder?.pause?.();
      set({ paused: true });
    } else {
      speech?.resume();
      recorder?.resume?.();
      ticker = setInterval(() => set((st) => ({ elapsedSec: st.elapsedSec + 0.25 })), 250);
      set({ paused: false });
    }
  },

  stopAndSave: async (articleId) => {
    if (ticker) { clearInterval(ticker); ticker = null; }
    speech?.stop();
    const chunks = recorder ? await recorder.stop() : [];
    recorder?.releaseStream();
    const { finals, elapsedSec } = get();
    const base = appendBase;
    appendBase = null;
    const durationSec = base
      ? base.timeBase + ((startedAtMs > 0 ? (Date.now() - startedAtMs) / 1000 : 0))
      : startedAtMs > 0
        ? (Date.now() - startedAtMs) / 1000
        : elapsedSec;
    startedAtMs = 0;
    let builtText = buildTranscript(finals).text;
    let newSegments: TranscriptSegment[] = buildTranscript(finals).segments.map((s) => ({
      ...s,
      id: '',
      articleId,
    }));
    // Shift appended segments onto the absolute timeline.
    if (base && base.timeBase > 0) {
      newSegments = newSegments.map((s) => ({
        ...s,
        startTimeSec: s.startTimeSec + base.timeBase,
        endTimeSec: s.endTimeSec + base.timeBase,
      }));
    }

    // Layer 2: prosody-detected silences become paragraph breaks (appended part only).
    if (featureOn('nakili-autopara') && boundariesSec.length > 0 && newSegments.length > 0) {
      const relBoundaries = boundariesSec
        .filter((t) => t >= (base?.timeBase ?? 0))
        .map((t) => t - (base?.timeBase ?? 0));
      const { insertOffsets } = planParagraphBreaks(builtText, newSegments, relBoundaries);
      for (const off of [...insertOffsets].sort((a, b) => b - a)) {
        const nextText = `${builtText.slice(0, off)}\n\n${builtText.slice(off)}`;
        newSegments = adjustSegmentsAfterEdit(newSegments, builtText, nextText);
        builtText = nextText;
      }
    }
    boundariesSec.length = 0;

    if (chunks.length > 0) {
      await saveSessionAudio(articleId, chunks.map((c) => c.blob), {
        startIndex: base?.indexBase ?? 0,
        startOffsetSec: base?.timeBase ?? 0,
      });
    }

    let text = builtText;
    if (base && base.prevLen > 0) {
      const prev = (await getArticle(articleId))?.transcriptText ?? '';
      text = `${prev}\n\n${builtText}`;
      const shift = prev.length + 2;
      newSegments = newSegments.map((s) => ({
        ...s,
        startCharOffset: s.startCharOffset + shift,
        endCharOffset: s.endCharOffset + shift,
      }));
    }

    const article = await getArticle(articleId);
    if (article) {
      await putArticle({
        ...article,
        transcriptText: text,
        durationSec: Math.max(durationSec, article.durationSec ?? 0),
        updatedAt: Date.now(),
      });
    }
    if (newSegments.length > 0) {
      await putSegments(newSegments.map((s) => ({ ...s, id: crypto.randomUUID(), articleId })));
    }

    speech = null;
    recorder = null;
    releaseWakeLock();
    if (currentDraftId) clearDraft(currentDraftId);
    currentDraftId = null;
    set({ status: 'idle', interimText: '' });
    useAppStore.getState().navigate('editor', articleId);
  },
}));
