import { create } from 'zustand';
import { getAudioBlob, getChunks } from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

interface PlaybackState {
  playingIndex: number | null;
  currentTimeSec: number;
  durationSec: number;
  error: string | null;
  toggle: (index: number) => Promise<void>;
  seek: (fraction: number) => void;
}

let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let prefetched: { index: number; url: string } | null = null;

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
    if (audioEl) usePlaybackStore.setState({ currentTimeSec: audioEl.currentTime });
  });
  audioEl.addEventListener('loadedmetadata', () => {
    if (audioEl) usePlaybackStore.setState({ durationSec: audioEl.duration || 0 });
  });
  const release = () => {
    revokeCurrent();
    prefetched = null;
  };
  audioEl.addEventListener('ended', () => {
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
    if (!chunk) return;

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
