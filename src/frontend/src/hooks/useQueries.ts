import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlaylistId, Song, UserProfile } from "../backend";
import { useActor } from "./useActor";

// ── Queries ──────────────────────────────────────────────────────────────────

export function useUserProfile() {
  const { actor, isFetching } = useActor();
  return useQuery<UserProfile | null>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAllPlaylists() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllPlaylists();
    },
    enabled: !!actor && !isFetching,
  });
}

export function usePlaylist(playlistId: bigint | null) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["playlist", playlistId?.toString()],
    queryFn: async () => {
      if (!actor || playlistId === null) return null;
      return actor.getPlaylist(playlistId);
    },
    enabled: !!actor && !isFetching && playlistId !== null,
  });
}

export function useLikedSongs() {
  const { actor, isFetching } = useActor();
  return useQuery<Song[]>({
    queryKey: ["likedSongs"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLikedSongs();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useListeningHistory() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getListeningHistory();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAllSongs() {
  const { actor, isFetching } = useActor();
  return useQuery<Song[]>({
    queryKey: ["allSongs"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllSongs();
    },
    enabled: !!actor && !isFetching,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSaveProfile() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("No actor");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userProfile"] }),
  });
}

export function useCacheSong() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (song: Song) => {
      if (!actor) throw new Error("No actor");
      return actor.cacheSong(song);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allSongs"] }),
  });
}

export function useLikeSong() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (songId: string) => {
      if (!actor) throw new Error("No actor");
      return actor.likeSong(songId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["likedSongs"] }),
  });
}

export function useUnlikeSong() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (songId: string) => {
      if (!actor) throw new Error("No actor");
      return actor.unlikeSong(songId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["likedSongs"] }),
  });
}

export function useCreatePlaylist() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("No actor");
      return actor.createPlaylist(name);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useDeletePlaylist() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playlistId: PlaylistId) => {
      if (!actor) throw new Error("No actor");
      return actor.deletePlaylist(playlistId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useRenamePlaylist() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      name,
    }: { playlistId: PlaylistId; name: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.renamePlaylist(playlistId, name);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddSongToPlaylist() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      songId,
    }: { playlistId: PlaylistId; songId: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.addSongToPlaylist(playlistId, songId);
    },
    onSuccess: (_d, { playlistId }) => {
      qc.invalidateQueries({ queryKey: ["playlist", playlistId.toString()] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useRemoveSongFromPlaylist() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      songId,
    }: { playlistId: PlaylistId; songId: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.removeSongFromPlaylist(playlistId, songId);
    },
    onSuccess: (_d, { playlistId }) => {
      qc.invalidateQueries({ queryKey: ["playlist", playlistId.toString()] });
    },
  });
}

export function useRecordListening() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (songId: string) => {
      if (!actor) throw new Error("No actor");
      return actor.recordListening(songId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });
}

export function useFetchLyrics(
  artist: string,
  title: string,
  enabled: boolean,
) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["lyrics", artist, title],
    queryFn: async () => {
      if (!actor) return "";
      return actor.fetchLyrics(artist, title);
    },
    enabled: !!actor && !isFetching && enabled && !!artist && !!title,
    staleTime: 1000 * 60 * 60,
  });
}

export function useCacheLyrics() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async ({
      songId,
      lyrics,
    }: { songId: string; lyrics: string }) => {
      if (!actor) throw new Error("No actor");
      return actor.cacheLyrics(songId, lyrics);
    },
  });
}
