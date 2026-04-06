import { create } from "zustand";
import type { Song } from "../backend";
import { userGet, userSet } from "../utils/userStorage";

export type RepeatMode = "none" | "one" | "all";

// Module-level seek callback so we don't store DOM objects in Zustand
let _seekCallback: ((seconds: number) => void) | null = null;

export function registerSeekCallback(cb: (seconds: number) => void) {
  _seekCallback = cb;
}

const LAST_SONG_KEY = "last_playing_song";

export function loadLastSong(): {
  song: Song;
  queue: Song[];
  queueIndex: number;
} | null {
  return userGet<{ song: Song; queue: Song[]; queueIndex: number } | null>(
    LAST_SONG_KEY,
    null,
  );
}

interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  progress: number;
  duration: number;
  volume: number;

  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  next: () => void;
  prev: () => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  seekTo: (seconds: number) => void;
  toggleShuffle: () => void;
  setRepeat: (mode: RepeatMode) => void;
  clearQueue: () => void;
  playNext: (song: Song) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  shuffle: false,
  repeat: "none",
  progress: 0,
  duration: 0,
  volume: 0.8,

  playSong: (song: Song, queue?: Song[]) => {
    const newQueue = queue || [song];
    const idx = newQueue.findIndex((s) => s.videoId === song.videoId);
    const queueIndex = idx >= 0 ? idx : 0;
    set({
      currentSong: song,
      queue: newQueue,
      queueIndex,
      isPlaying: true,
      progress: 0,
      duration: 0,
    });
    // Persist last song for resume
    userSet(LAST_SONG_KEY, { song, queue: newQueue, queueIndex });
  },

  togglePlay: () => {
    set((s) => ({ isPlaying: !s.isPlaying }));
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  next: () => {
    const { queue, queueIndex, shuffle, repeat } = get();
    if (queue.length === 0) return;
    let nextIdx: number;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (queueIndex < queue.length - 1) {
      nextIdx = queueIndex + 1;
    } else if (repeat === "all") {
      nextIdx = 0;
    } else {
      set({ isPlaying: false });
      return;
    }
    set({
      currentSong: queue[nextIdx],
      queueIndex: nextIdx,
      isPlaying: true,
      progress: 0,
      duration: 0,
    });
  },

  prev: () => {
    const { queue, queueIndex, progress } = get();
    if (queue.length === 0) return;
    if (progress > 3) {
      if (_seekCallback) _seekCallback(0);
      set({ progress: 0 });
      return;
    }
    const prevIdx = queueIndex > 0 ? queueIndex - 1 : 0;
    set({
      currentSong: queue[prevIdx],
      queueIndex: prevIdx,
      isPlaying: true,
      progress: 0,
      duration: 0,
    });
  },

  addToQueue: (song: Song) => {
    set((s) => {
      const insertAt = s.queue.length === 0 ? 0 : s.queueIndex + 1;
      const newQueue = [...s.queue];
      newQueue.splice(insertAt, 0, song);
      return { queue: newQueue };
    });
  },

  removeFromQueue: (index: number) => {
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index);
      const newIdx =
        index < s.queueIndex
          ? s.queueIndex - 1
          : Math.min(s.queueIndex, newQueue.length - 1);
      return { queue: newQueue, queueIndex: Math.max(0, newIdx) };
    });
  },

  reorderQueue: (fromIndex: number, toIndex: number) => {
    set((s) => {
      const newQueue = [...s.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      let newIdx = s.queueIndex;
      if (fromIndex === s.queueIndex) newIdx = toIndex;
      else if (fromIndex < s.queueIndex && toIndex >= s.queueIndex) newIdx--;
      else if (fromIndex > s.queueIndex && toIndex <= s.queueIndex) newIdx++;
      return { queue: newQueue, queueIndex: Math.max(0, newIdx) };
    });
  },

  setProgress: (progress: number) => set({ progress }),
  setDuration: (duration: number) => set({ duration }),
  setVolume: (volume: number) => set({ volume }),

  seekTo: (seconds: number) => {
    if (_seekCallback) _seekCallback(seconds);
    set({ progress: seconds });
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  setRepeat: (mode: RepeatMode) => set({ repeat: mode }),

  clearQueue: () => {
    set((s) => {
      const q = s.currentSong ? [s.currentSong] : [];
      return { queue: q, queueIndex: 0 };
    });
  },

  playNext: (song: Song) => {
    set((s) => {
      const insertAt = s.queue.length === 0 ? 0 : s.queueIndex + 1;
      const newQueue = [...s.queue];
      newQueue.splice(insertAt, 0, song);
      const newIdx = insertAt;
      userSet(LAST_SONG_KEY, { song, queue: newQueue, queueIndex: newIdx });
      return {
        currentSong: song,
        queue: newQueue,
        queueIndex: newIdx,
        isPlaying: true,
        progress: 0,
        duration: 0,
      };
    });
  },
}));
