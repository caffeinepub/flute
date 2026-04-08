import type { Song } from "../types/song";
import { userGet, userSet } from "./userStorage";

export function getLikedSongs(): Song[] {
  return userGet<Song[]>("liked_songs", []);
}

export function likeSong(song: Song): void {
  const liked = getLikedSongs();
  if (!liked.find((s) => s.videoId === song.videoId)) {
    userSet("liked_songs", [...liked, song]);
  }
}

export function unlikeSong(videoId: string): void {
  userSet(
    "liked_songs",
    getLikedSongs().filter((s) => s.videoId !== videoId),
  );
}

export function isLiked(videoId: string): boolean {
  return getLikedSongs().some((s) => s.videoId === videoId);
}
