import { create } from 'zustand';
import { SpeechService } from '../../core/services/SpeechService';
import { RecorderService } from '../../core/services/RecorderService';
import { buildTranscript, type FinalResult } from '../../core/services/MappingService';
import {
  saveSessionAudio, putArticle, getArticle, putSegments,
} from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

let speech: SpeechService | null = null;
let recorder: RecorderService | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let startedAtMs = 0;
let currentDraftId: string | null = null;

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
  elapsedSec: number;
  interimText: string;
  finals: FinalResult[];
  errorMessage: string | null;
  recorderNotice: string | null;
  start: () => Promise<void>;
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
    const draftId = useAppStore.getState().activeArticleId;
    if (draftId) {
      currentDraftId = draftId;
      const draft = loadDraft(draftId);
      if (draft.length > 0) set({ finals: draft });
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
    speech!.onFinal = (text, elapsedSec) =>
      set((s) => {
        const finals = [...s.finals, { text, startTimeSec: elapsedSec, endTimeSec: elapsedSec }];
        // Crash-recovery point: persist every confirmed phrase.
        if (currentDraftId) saveDraft(currentDraftId, finals);
        return { finals, interimText: '' };
      });
    speech!.onError = (err, fatal) => {
      if (fatal) {
        set({ errorMessage: `[ERROR: SPEECH RECOGNITION ${err.toUpperCase()} — AUDIO KEEPS RECORDING, LIVE TEXT PAUSED]` });
      }
    };
    recorder!.onError = () => {
      set({ recorderNotice: '[NOTICE: AUDIO RECORDING ERROR — CAPTURED AUDIO IS KEPT]' });
    };
    recorder!.start();
    speech!.start();
    startedAtMs = Date.now();
    ticker = setInterval(() => {
      set((s) => ({ elapsedSec: s.elapsedSec + 0.25 }));
    }, 250);
    set({ status: 'recording' });
  },

  stopAndSave: async (articleId) => {
    if (ticker) { clearInterval(ticker); ticker = null; }
    speech?.stop();
    const chunks = recorder ? await recorder.stop() : [];
    recorder?.releaseStream();
    const { finals, elapsedSec } = get();
    const durationSec = startedAtMs > 0 ? (Date.now() - startedAtMs) / 1000 : elapsedSec;
    startedAtMs = 0;
    const { text, segments } = buildTranscript(finals);

    if (chunks.length > 0) {
      await saveSessionAudio(articleId, chunks.map((c) => c.blob));
    }
    const article = await getArticle(articleId);
    if (article) {
      await putArticle({
        ...article,
        transcriptText: text,
        durationSec,
        updatedAt: Date.now(),
      });
    }
    if (segments.length > 0) {
      await putSegments(segments.map((s) => ({ ...s, id: crypto.randomUUID(), articleId })));
    }

    speech = null;
    recorder = null;
    if (currentDraftId) clearDraft(currentDraftId);
    currentDraftId = null;
    set({ status: 'idle', interimText: '' });
    useAppStore.getState().navigate('editor', articleId);
  },
}));
