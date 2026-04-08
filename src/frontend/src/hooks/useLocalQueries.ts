import { useCallback, useState } from "react";
import type { Song } from "../types/song";
import * as LL from "../utils/localLikedSongs";
import * as LP from "../utils/localPlaylists";

export function useLocalPlaylists() {
  const [playlists, setPlaylists] = useState<LP.LocalPlaylist[]>(() =>
    LP.getPlaylists(),
  );

  const refresh = useCallback(() => setPlaylists(LP.getPlaylists()), []);

  const create = useCallback(
    (name: string) => {
      LP.createPlaylist(name);
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    (id: string) => {
      LP.deletePlaylist(id);
      refresh();
    },
    [refresh],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      LP.renamePlaylist(id, name);
      refresh();
    },
    [refresh],
  );

  const addSong = useCallback(
    (playlistId: string, song: Song) => {
      const cache = JSON.parse(
        localStorage.getItem("flute_song_cache") || "{}",
      );
      cache[song.videoId] = song;
      localStorage.setItem("flute_song_cache", JSON.stringify(cache));
      LP.addSongToPlaylist(playlistId, song.videoId);
      refresh();
    },
    [refresh],
  );

  const removeSong = useCallback(
    (playlistId: string, videoId: string) => {
      LP.removeSongFromPlaylist(playlistId, videoId);
      refresh();
    },
    [refresh],
  );

  return { playlists, create, remove, rename, addSong, removeSong, refresh };
}

export function useLocalLikedSongs() {
  const [likedSongs, setLikedSongs] = useState<Song[]>(() =>
    LL.getLikedSongs(),
  );

  const refresh = useCallback(() => setLikedSongs(LL.getLikedSongs()), []);

  const like = useCallback(
    (song: Song) => {
      LL.likeSong(song);
      refresh();
    },
    [refresh],
  );

  const unlike = useCallback(
    (videoId: string) => {
      LL.unlikeSong(videoId);
      refresh();
    },
    [refresh],
  );

  const checkIsLiked = useCallback((id: string) => LL.isLiked(id), []);

  return { likedSongs, like, unlike, isLiked: checkIsLiked, refresh };
}
