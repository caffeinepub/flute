/**
 * useQueries.ts
 *
 * All data for Flute is stored locally (localStorage).
 * These hooks provide a React Query wrapper over local utilities,
 * keeping the same interface as before but without a backend actor.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlaylistId, Song, UserProfile } from "../types/song";
import {
  getLikedSongs,
  isLiked,
  likeSong,
  unlikeSong,
} from "../utils/localLikedSongs";
import {
  addSongToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylists,
  removeSongFromPlaylist,
  renamePlaylist,
} from "../utils/localPlaylists";

// ── Queries ──────────────────────────────────────────────────────────────────

export function useUserProfile() {
  return useQuery<UserProfile | null>({
    queryKey: ["userProfile"],
    queryFn: async () => null,
  });
}

export function useAllPlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => getPlaylists(),
  });
}

export function usePlaylist(playlistId: PlaylistId | null) {
  return useQuery({
    queryKey: ["playlist", playlistId?.toString()],
    queryFn: async () => {
      if (playlistId === null) return null;
      const pls = getPlaylists();
      return pls.find((p) => p.id === playlistId.toString()) ?? null;
    },
    enabled: playlistId !== null,
  });
}

export function useLikedSongs() {
  return useQuery<Song[]>({
    queryKey: ["likedSongs"],
    queryFn: async () => getLikedSongs(),
  });
}

export function useListeningHistory() {
  return useQuery({
    queryKey: ["history"],
    queryFn: async () => [] as Song[],
  });
}

export function useAllSongs() {
  return useQuery<Song[]>({
    queryKey: ["allSongs"],
    queryFn: async () => {
      try {
        const cache = JSON.parse(
          localStorage.getItem("flute_song_cache") || "{}",
        ) as Record<string, Song>;
        return Object.values(cache);
      } catch {
        return [];
      }
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSaveProfile() {
  return useMutation({
    mutationFn: async (_profile: UserProfile) => {
      // No-op — profiles not implemented
    },
  });
}

export function useCacheSong() {
  return useMutation({
    mutationFn: async (song: Song) => {
      try {
        const cache = JSON.parse(
          localStorage.getItem("flute_song_cache") || "{}",
        ) as Record<string, Song>;
        cache[song.videoId] = song;
        localStorage.setItem("flute_song_cache", JSON.stringify(cache));
      } catch {
        // ignore
      }
    },
  });
}

export function useLikeSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (songId: string) => {
      const cache = JSON.parse(
        localStorage.getItem("flute_song_cache") || "{}",
      ) as Record<string, Song>;
      const song = cache[songId];
      if (song) likeSong(song);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["likedSongs"] }),
  });
}

export function useUnlikeSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (songId: string) => {
      unlikeSong(songId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["likedSongs"] }),
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      return createPlaylist(name);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playlistId: PlaylistId) => {
      deletePlaylist(playlistId.toString());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useRenamePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      name,
    }: { playlistId: PlaylistId; name: string }) => {
      renamePlaylist(playlistId.toString(), name);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddSongToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      songId,
    }: { playlistId: PlaylistId; songId: string }) => {
      addSongToPlaylist(playlistId.toString(), songId);
    },
    onSuccess: (_d, { playlistId }) => {
      qc.invalidateQueries({ queryKey: ["playlist", playlistId.toString()] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useRemoveSongFromPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      songId,
    }: { playlistId: PlaylistId; songId: string }) => {
      removeSongFromPlaylist(playlistId.toString(), songId);
    },
    onSuccess: (_d, { playlistId }) => {
      qc.invalidateQueries({ queryKey: ["playlist", playlistId.toString()] });
    },
  });
}

export function useRecordListening() {
  return useMutation({
    mutationFn: async (_songId: string) => {
      // Listening is tracked locally via addToLocalHistory in YouTubePlayer
    },
  });
}

export function useFetchLyrics(
  _artist: string,
  _title: string,
  _enabled: boolean,
) {
  return useQuery<string>({
    queryKey: ["lyrics", _artist, _title],
    queryFn: async () => "",
    enabled: false,
    staleTime: 1000 * 60 * 60,
  });
}

export function useCacheLyrics() {
  return useMutation({
    mutationFn: async ({
      songId: _songId,
      lyrics: _lyrics,
    }: { songId: string; lyrics: string }) => {
      // No-op — lyrics caching not implemented locally
    },
  });
}

/** Check if a song is liked (used in NowPlaying). */
export function useIsLiked(videoId: string): boolean {
  return isLiked(videoId);
}
