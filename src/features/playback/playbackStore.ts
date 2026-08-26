import { create } from 'zustand';
import { getAudioBlob, getChunks } from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';
import { detectSilenceRanges } from '../../core/services/audioAnalysis';

interface PlaybackState {
  playingIndex: number | null;
  currentTimeSec: number;
  durationSec: number;
  error: string | null;
  loop: boolean;
  rate: number;
  autoNext: boolean;
  skipSilence: boolean;
  setLoop: (v: boolean) => void;
  setRate: (r: number) => void;
  setSkipSilence: (v: boolean) => void;
  toggle: (index: number) => Promise<void>;
  seek: (fraction: number) => void;
}

function storedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'on';
  } catch {
    return false;
  }
}

let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let prefetched: { index: number; url: string } | null = null;
const silenceCache = new Map<number, Array<{ startSec: number; endSec: number }>>();
const computingSilence = new Set<number>();

function revokeCurrent(): void {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/** Pre-buffer the blob after the playing clip to cut playback start delay. */
async function prefetchNext(articleId: string, index: number): Promise<void> {
  try {
    const chunks = await getChunks(articleId);
    const next = chunks.find((c) => c.index === index + 1);
    if (!next) return;
    const blob = await getAudioBlob(next.blobKey);
    if (blob) prefetched = { index: next.index, url: URL.createObjectURL(blob) };
  } catch {
    /* prefetch is best-effort */
  }
}

function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.addEventListener('timeupdate', () => {
    if (!audioEl) return;
    const st = usePlaybackStore.getState();
    if (st.skipSilence && st.playingIndex !== null) {
      const ranges = silenceCache.get(st.playingIndex);
      const hit = ranges?.find((r) => audioEl!.currentTime >= r.startSec - 0.02 && audioEl!.currentTime < r.endSec);
      if (hit) {
        try { audioEl.currentTime = hit.endSec + 0.01; } catch { /* jsdom */ }
      }
    }
    usePlaybackStore.setState({ currentTimeSec: audioEl.currentTime });
  });
  audioEl.addEventListener('loadedmetadata', () => {
    if (audioEl) usePlaybackStore.setState({ durationSec: audioEl.duration || 0 });
  });
  const release = () => {
    revokeCurrent();
    prefetched = null;
  };
  audioEl.addEventListener('ended', () => {
    const st = usePlaybackStore.getState();
    if (st.autoNext && st.playingIndex !== null) {
      void st.toggle(st.playingIndex + 1);
      return;
    }
    release();
    usePlaybackStore.setState({ playingIndex: null });
  });
  audioEl.addEventListener('pause', () => {
    // Keep the URL while paused mid-clip; free it once nothing is active.
    if (usePlaybackStore.getState().playingIndex === null) release();
  });
  audioEl.addEventListener('error', () => {
    const detail = audioEl?.error
      ? `${audioEl.error.message || audioEl.error.code}`
      : 'UNKNOWN';
    // Inline status — no toasts in the Nothing system.
    release();
    usePlaybackStore.setState({ playingIndex: null, error: `[PLAYBACK ERROR: ${detail.toUpperCase()}]` });
  });
  return audioEl;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  playingIndex: null,
  currentTimeSec: 0,
  durationSec: 0,
  error: null,
  loop: false,
  rate: 1,
  autoNext: storedFlag('nakili-autonext'),
  skipSilence: storedFlag('nakili-skipsilence'),

  setLoop: (v) => {
    if (audioEl) audioEl.loop = v;
    set({ loop: v });
  },

  setRate: (r) => {
    if (audioEl) audioEl.playbackRate = r;
    set({ rate: r });
  },

  setSkipSilence: (v) => {
    try { localStorage.setItem('nakili-skipsilence', v ? 'on' : 'off'); } catch { /* ignore */ }
    set({ skipSilence: v });
  },

  toggle: async (index) => {
    const el = ensureAudio();

    if (get().playingIndex === index) {
      el.pause();
      set({ playingIndex: null });
      return;
    }

    const articleId = useAppStore.getState().activeArticleId;
    if (!articleId) return;

    // Reuse the pre-buffered clip when it's the one requested.
    let url: string | null = null;
    if (prefetched?.index === index) {
      ({ url } = prefetched);
      prefetched = null;
    }

    const chunks = await getChunks(articleId);
    const chunk = chunks.find((c) => c.index === index);
    if (!chunk) {
      // Auto-advance ran past the final clip.
      revokeCurrent();
      set({ playingIndex: null });
      return;
    }

    if (!url) {
      const blob = await getAudioBlob(chunk.blobKey);
      if (!blob) return;
      url = URL.createObjectURL(blob);
    }

    set({ error: null });

    revokeCurrent();
    currentUrl = url;
    el.src = currentUrl;
    // Some engines need an explicit load after re-pointing src on a reused element.
    try {
      el.load();
    } catch {
      /* jsdom: no media backend */
    }
    el.loop = get().loop;
    el.playbackRate = get().rate;
    // Lock-screen / media-key controls (best-effort).
    try {
      if ('mediaSession' in navigator) {
        const { getArticle } = await import('../../core/db/repositories');
        const art = await getArticle(articleId);
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${art?.title ?? 'Recording'} — Clip ${index + 1}`,
          artist: 'Nakili',
        });
        navigator.mediaSession.setActionHandler('pause', () => el.pause());
        navigator.mediaSession.setActionHandler('play', () => { void el.play().catch(() => {}); });
      }
    } catch {
      /* media session unsupported */
    }
    el.loop = get().loop;
    el.playbackRate = get().rate;
    set({
      playingIndex: index,
      currentTimeSec: 0,
      durationSec: chunk.durationSec || el.duration || 0,
    });

    try {
      await el.play();
    } catch {
      // jsdom has no media backend; browsers may block autoplay. State stands.
    }
    // Warm the next clip so sequential listening starts instantly.
    void prefetchNext(articleId, index);

    // Pre-compute silence map for skip-silence playback.
    if (get().skipSilence && !silenceCache.has(index) && !computingSilence.has(index)) {
      computingSilence.add(index);
      const blob = await getAudioBlob(chunk.blobKey);
      if (blob) {
        try {
          const Ctx = window.AudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
            silenceCache.set(index, detectSilenceRanges(buf.getChannelData(0), buf.sampleRate));
            void ctx.close().catch(() => {});
          }
        } catch {
          /* analysis is optional */
        }
      }
      computingSilence.delete(index);
    }
  },

  seek: (fraction) => {
    const el = ensureAudio();
    const d = get().durationSec || el.duration || 0;
    const t = Math.max(0, Math.min(1, fraction)) * d;
    try {
      el.currentTime = t;
    } catch {
      /* jsdom: setting currentTime unsupported */
    }
    set({ currentTimeSec: t });
  },
}));
