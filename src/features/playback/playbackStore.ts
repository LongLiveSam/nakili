import { create } from 'zustand';
import { getAudioBlob, getChunks } from '../../core/db/repositories';
import { useAppStore } from '../../ui/appStore';

interface PlaybackState {
  playingIndex: number | null;
  currentTimeSec: number;
  durationSec: number;
  toggle: (index: number) => Promise<void>;
  seek: (fraction: number) => void;
}

let audioEl: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.addEventListener('timeupdate', () => {
    if (audioEl) usePlaybackStore.setState({ currentTimeSec: audioEl.currentTime });
  });
  audioEl.addEventListener('loadedmetadata', () => {
    if (audioEl) usePlaybackStore.setState({ durationSec: audioEl.duration || 0 });
  });
  audioEl.addEventListener('ended', () => {
    usePlaybackStore.setState({ playingIndex: null });
  });
  return audioEl;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  playingIndex: null,
  currentTimeSec: 0,
  durationSec: 0,

  toggle: async (index) => {
    const el = ensureAudio();

    if (get().playingIndex === index) {
      el.pause();
      set({ playingIndex: null });
      return;
    }

    const articleId = useAppStore.getState().activeArticleId;
    if (!articleId) return;

    const chunks = await getChunks(articleId);
    const chunk = chunks.find((c) => c.index === index);
    if (!chunk) return;

    const blob = await getAudioBlob(chunk.blobKey);
    if (!blob) return;

    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    el.src = currentUrl;
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
