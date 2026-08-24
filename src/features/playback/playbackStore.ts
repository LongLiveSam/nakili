import { create } from 'zustand';

interface PlaybackState {
  playingIndex: number | null;
  currentTimeSec: number;
  durationSec: number;
  toggle: (index: number) => Promise<void>;
  seek: (fraction: number) => void;
}

// Stub until Task 12 wires real audio playback.
export const usePlaybackStore = create<PlaybackState>((set) => ({
  playingIndex: null,
  currentTimeSec: 0,
  durationSec: 0,
  toggle: async () => set({}),
  seek: () => set({}),
}));
