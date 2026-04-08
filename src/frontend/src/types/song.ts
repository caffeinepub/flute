/**
 * Core domain types for Flute.
 * These are defined here since the backend canister does not expose them via bindgen.
 */

/** A music track returned from the Piped API and stored locally. */
export interface Song {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  lyrics?: string;
}

/** Playlist identifier (local storage uses string IDs). */
export type PlaylistId = string | bigint;

/** Basic user profile shape. */
export interface UserProfile {
  username: string;
  [key: string]: unknown;
}
