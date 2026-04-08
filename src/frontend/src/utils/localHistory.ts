import type { Song } from "../types/song";

export interface HistoryEntry {
  song: Song;
  timestamp: number;
}

const KEY = "flute_local_history";
const MAX = 100;

export function addToLocalHistory(song: Song): void {
  const entries = getLocalHistory();
  // Remove duplicate if already in history
  const deduped = entries.filter((e) => e.song.videoId !== song.videoId);
  const updated = [{ song, timestamp: Date.now() }, ...deduped].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function getLocalHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}
