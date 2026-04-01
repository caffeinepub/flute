import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface PlaylistView {
    id: PlaylistId;
    name: string;
    songs: Array<SongId>;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Time = bigint;
export type SongId = string;
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Song {
    title: string;
    duration: string;
    thumbnail: string;
    lyrics?: string;
    channel: string;
    videoId: SongId;
}
export type PlaylistId = bigint;
export interface HistoryEntry {
    songId: SongId;
    timestamp: Time;
}
export interface UserProfile {
    name: string;
}
export interface http_header {
    value: string;
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addSongToPlaylist(playlistId: PlaylistId, songId: SongId): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    cacheLyrics(songId: SongId, lyrics: string): Promise<void>;
    cacheSong(song: Song): Promise<void>;
    createPlaylist(name: string): Promise<PlaylistId>;
    deletePlaylist(playlistId: PlaylistId): Promise<void>;
    fetchLyrics(artist: string, title: string): Promise<string>;
    getAllPlaylists(): Promise<Array<PlaylistView>>;
    getAllSongs(): Promise<Array<Song>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getLikedSongs(): Promise<Array<Song>>;
    getListeningHistory(): Promise<Array<HistoryEntry>>;
    getPlaylist(playlistId: PlaylistId): Promise<PlaylistView | null>;
    getSong(songId: SongId): Promise<Song | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    likeSong(songId: SongId): Promise<void>;
    recordListening(songId: SongId): Promise<void>;
    removeSongFromPlaylist(playlistId: PlaylistId, songId: SongId): Promise<void>;
    renamePlaylist(playlistId: PlaylistId, newName: string): Promise<void>;
    reorderPlaylist(playlistId: PlaylistId, newOrder: Array<SongId>): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    unlikeSong(songId: SongId): Promise<void>;
}
