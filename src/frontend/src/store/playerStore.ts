import { create } from "zustand";
import { pipedFetch } from "../lib/invidious";
import type { Song } from "../types/song";
import { refetchStreamData } from "../utils/pipedRecommendations";
import { userGet, userSet } from "../utils/userStorage";

// ISSUE 5 FIX: track all videoIds played in this session to prevent queue loops
export const sessionPlayedIds = new Set<string>();

export type RepeatMode = "none" | "one" | "all";
export type PlaybackSource = "queue" | "similar";

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

interface PipedStreamsData {
  audioStreams: Array<{ url: string; bitrate: number; mimeType: string }>;
  duration?: number;
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

  // Playback source: which tab controls next/prev navigation
  currentSource: PlaybackSource;
  setCurrentSource: (source: PlaybackSource) => void;

  // Similar songs queue for source-aware navigation
  similarQueue: Song[];
  similarQueueIndex: number;

  // Broken song tracking (array for Zustand serialization)
  brokenSongs: string[];
  markBroken: (videoId: string) => void;
  fixSong: (videoId: string) => Promise<void>;

  // Sticky notification
  stickyNotification: boolean;
  setStickyNotification: (val: boolean) => void;

  playSong: (song: Song, queue?: Song[]) => void;
  playSongFromSimilar: (song: Song, similarList: Song[]) => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  next: () => void;
  prev: () => void;
  addToQueue: (song: Song) => void;
  addToSimilar: (song: Song) => void;
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
  appendSimilarToQueue: (songs: Song[]) => void;
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

  currentSource: "queue",
  setCurrentSource: (source) => set({ currentSource: source }),

  similarQueue: [],
  similarQueueIndex: 0,

  brokenSongs: [] as string[],
  markBroken: (videoId: string) => {
    set((s) => {
      if (s.brokenSongs.includes(videoId)) return s;
      return { brokenSongs: [...s.brokenSongs, videoId] };
    });
  },
  fixSong: async (videoId: string) => {
    try {
      // ISSUE 3 FIX: Use refetchStreamData which races all instances simultaneously
      const refetched = await refetchStreamData(videoId);
      if (refetched?.streamUrl && refetched.duration > 0) {
        // Remove from broken array
        set((s) => ({
          brokenSongs: s.brokenSongs.filter((id) => id !== videoId),
        }));

        const { currentSong, queue, queueIndex } = get();
        if (currentSong?.videoId === videoId) {
          set({
            currentSong: { ...currentSong },
            isPlaying: true,
            progress: 0,
            duration: refetched.duration,
          });
          userSet(LAST_SONG_KEY, { song: currentSong, queue, queueIndex });
        }
        return;
      }

      // Fallback: original pipedFetch approach
      const data = (await pipedFetch(
        `/streams/${videoId}`,
      )) as PipedStreamsData;
      const streams = data?.audioStreams ?? [];
      if (streams.length === 0) throw new Error("No streams");

      const sorted = [...streams].sort(
        (a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0),
      );
      const mp4 = sorted.find((s) => s.mimeType?.includes("audio/mp4"));
      const webm = sorted.find((s) => s.mimeType?.includes("audio/webm"));
      const best = mp4 ?? webm ?? sorted[0];

      if (!best?.url) throw new Error("No valid stream");

      set((s) => ({
        brokenSongs: s.brokenSongs.filter((id) => id !== videoId),
      }));

      const { currentSong, queue, queueIndex } = get();
      if (currentSong?.videoId === videoId) {
        set({
          currentSong: { ...currentSong },
          isPlaying: true,
          progress: 0,
          duration: 0,
        });
        userSet(LAST_SONG_KEY, { song: currentSong, queue, queueIndex });
      }
    } catch {
      // silent — song remains broken
    }
  },

  stickyNotification: (() => {
    try {
      const stored = localStorage.getItem("flute_sticky_notification");
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  })(),
  setStickyNotification: (val: boolean) => {
    try {
      localStorage.setItem("flute_sticky_notification", String(val));
    } catch {}
    set({ stickyNotification: val });
  },

  playSong: (song: Song, queue?: Song[]) => {
    const newQueue = queue || [song];
    const idx = newQueue.findIndex((s) => s.videoId === song.videoId);
    const queueIndex = idx >= 0 ? idx : 0;
    // ISSUE 5 FIX: record in session history
    sessionPlayedIds.add(song.videoId);
    set({
      currentSong: song,
      queue: newQueue,
      queueIndex,
      isPlaying: true,
      progress: 0,
      duration: 0,
      currentSource: "queue",
    });
    userSet(LAST_SONG_KEY, { song, queue: newQueue, queueIndex });
  },

  playSongFromSimilar: (song: Song, similarList: Song[]) => {
    const idx = similarList.findIndex((s) => s.videoId === song.videoId);
    const similarQueueIndex = idx >= 0 ? idx : 0;
    const newQueue = [
      song,
      ...similarList.filter((s) => s.videoId !== song.videoId),
    ];
    // ISSUE 5 FIX: record in session history
    sessionPlayedIds.add(song.videoId);
    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: 0,
      similarQueue: similarList,
      similarQueueIndex,
      isPlaying: true,
      progress: 0,
      duration: 0,
      currentSource: "similar",
    });
    userSet(LAST_SONG_KEY, { song, queue: newQueue, queueIndex: 0 });
  },

  togglePlay: () => {
    set((s) => ({ isPlaying: !s.isPlaying }));
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  next: () => {
    const {
      currentSource,
      similarQueue,
      similarQueueIndex,
      queue,
      queueIndex,
      shuffle,
      repeat,
    } = get();

    if (currentSource === "similar" && similarQueue.length > 0) {
      let nextIdx: number;
      if (shuffle) {
        nextIdx = Math.floor(Math.random() * similarQueue.length);
      } else if (similarQueueIndex < similarQueue.length - 1) {
        nextIdx = similarQueueIndex + 1;
      } else if (repeat === "all") {
        nextIdx = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
      const nextSong = similarQueue[nextIdx];
      // ISSUE 5 FIX: record in session history
      sessionPlayedIds.add(nextSong.videoId);
      set({
        currentSong: nextSong,
        similarQueueIndex: nextIdx,
        isPlaying: true,
        progress: 0,
        duration: 0,
      });
      return;
    }

    // Default: navigate in queue
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
    const nextSong = queue[nextIdx];
    // ISSUE 5 FIX: record in session history
    sessionPlayedIds.add(nextSong.videoId);
    set({
      currentSong: nextSong,
      queueIndex: nextIdx,
      isPlaying: true,
      progress: 0,
      duration: 0,
    });
  },

  prev: () => {
    const {
      currentSource,
      similarQueue,
      similarQueueIndex,
      queue,
      queueIndex,
      progress,
    } = get();

    if (currentSource === "similar" && similarQueue.length > 0) {
      if (progress > 3) {
        if (_seekCallback) _seekCallback(0);
        set({ progress: 0 });
        return;
      }
      const prevIdx = similarQueueIndex > 0 ? similarQueueIndex - 1 : 0;
      set({
        currentSong: similarQueue[prevIdx],
        similarQueueIndex: prevIdx,
        isPlaying: true,
        progress: 0,
        duration: 0,
      });
      return;
    }

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

  addToSimilar: (song: Song) => {
    set((s) => {
      const insertAt = s.similarQueueIndex + 1;
      const newSimilar = [...s.similarQueue];
      newSimilar.splice(insertAt, 0, song);
      return { similarQueue: newSimilar };
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
        currentSource: "queue",
      };
    });
  },

  appendSimilarToQueue: (songs: Song[]) => {
    set((s) => {
      const existingIds = new Set(s.queue.map((q) => q.videoId));
      const newSongs = songs.filter((song) => !existingIds.has(song.videoId));
      if (newSongs.length === 0) return s;
      return { queue: [...s.queue, ...newSongs] };
    });
  },
}));
