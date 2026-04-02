import { userGet, userSet } from "./userStorage";

export interface LocalPlaylist {
  id: string;
  name: string;
  songs: string[];
  createdAt: number;
}

export function getPlaylists(): LocalPlaylist[] {
  return userGet<LocalPlaylist[]>("playlists", []);
}

export function savePlaylists(playlists: LocalPlaylist[]): void {
  userSet("playlists", playlists);
}

export function createPlaylist(name: string): LocalPlaylist {
  const pl: LocalPlaylist = {
    id: Date.now().toString(),
    name,
    songs: [],
    createdAt: Date.now(),
  };
  savePlaylists([...getPlaylists(), pl]);
  return pl;
}

export function deletePlaylist(id: string): void {
  savePlaylists(getPlaylists().filter((p) => p.id !== id));
}

export function renamePlaylist(id: string, name: string): void {
  savePlaylists(getPlaylists().map((p) => (p.id === id ? { ...p, name } : p)));
}

export function addSongToPlaylist(playlistId: string, videoId: string): void {
  savePlaylists(
    getPlaylists().map((p) =>
      p.id === playlistId && !p.songs.includes(videoId)
        ? { ...p, songs: [...p.songs, videoId] }
        : p,
    ),
  );
}

export function removeSongFromPlaylist(
  playlistId: string,
  videoId: string,
): void {
  savePlaylists(
    getPlaylists().map((p) =>
      p.id === playlistId
        ? { ...p, songs: p.songs.filter((s) => s !== videoId) }
        : p,
    ),
  );
}
