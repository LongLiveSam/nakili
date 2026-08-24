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

/** Test seam: inject fakes instead of constructing real browser services. */
export function __setServicesForTest(s: SpeechService, r: RecorderService): void {
  speech = s;
  recorder = r;
}

function makeServices(): void {
  speech = new SpeechService();
  recorder = new RecorderService();
}

interface RecordingState {
  status: 'idle' | 'recording';
  elapsedSec: number;
  interimText: string;
  finals: FinalResult[];
  errorMessage: string | null;
  start: () => Promise<void>;
  stopAndSave: (articleId: string) => Promise<void>;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  status: 'idle',
  elapsedSec: 0,
  interimText: '',
  finals: [],
  errorMessage: null,

  start: async () => {
    if (get().status === 'recording') return;
    set({ errorMessage: null, finals: [], interimText: '', elapsedSec: 0 });
    if (!speech || !recorder) makeServices();
    try {
      await recorder!.requestMicrophone();
    } catch {
      set({
        errorMessage:
          'Microphone access was denied. Allow microphone permission for this site in your browser settings, then try again.',
      });
      speech = null;
      recorder = null;
      return;
    }
    speech!.onInterim = (t) => set({ interimText: t });
    speech!.onFinal = (text, elapsedSec) =>
      set((s) => ({
        finals: [...s.finals, { text, startTimeSec: elapsedSec, endTimeSec: elapsedSec }],
        interimText: '',
      }));
    speech!.onError = (err, fatal) => {
      if (fatal) {
        set({ errorMessage: `Speech recognition error: ${err}. Audio keeps recording; live text paused.` });
      }
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
    set({ status: 'idle', interimText: '' });
    useAppStore.getState().navigate('editor', articleId);
  },
}));
