# Flute - Version 17

## Current State

Flute is a mobile-first, Spotify-style music streaming app using Piped API. It has username-based local auth, queue management, history, playlists (via ICP backend with anonymous principal), liked songs, and smart recommendations. The app has recurring issues:
- Login button doesn't work on first tap (AuthProvider missing from main.tsx)
- Playlists broken (Add to Playlist doesn't work)
- Similar songs tab uses sequential fetching (slow/unreliable)
- Queue addToQueue appends to end instead of after current song
- No search memory, no resume last song, no sleep timer
- User data (history, playlists, liked songs) is shared across all anonymous users on the same device, not per-username

## Requested Changes (Diff)

### Add
- **AuthProvider wrap in main.tsx** -- permanently fix login by wrapping app with AuthContext provider
- **Per-username data isolation** -- all localStorage keys (history, liked songs, mood prefs, etc.) prefixed with username so each user's data is separate; this provides "cloud-like" isolation between users on same device
- **Search memory** -- save last search query to localStorage per username; restore it when Search page opens
- **Resume last song** -- save last played song + queue to localStorage; on app open, show it in player bar paused (not auto-playing)
- **Sleep timer** -- button in Settings (or NowPlaying) to set a countdown (15, 30, 45, 60 min) after which playback stops; shows remaining time
- **Queue insert-after-current** -- `addToQueue` inserts song at `queueIndex + 1` instead of appending to end

### Modify
- **Similar songs** -- change `fetchRelatedSongs` in `pipedRecommendations.ts` to use `Promise.any()` racing all instances in parallel instead of sequential for loop
- **Playlists** -- investigate and fix Add to Playlist flow; ensure `addSongToPlaylist` mutation is properly triggered from SongCard context menu / song options; store playlists in localStorage per-username as fallback if backend fails
- **History** -- use per-username localStorage key so history is not shared across users
- **Liked Songs** -- use per-username localStorage key

### Remove
- Nothing removed

## Implementation Plan

1. **main.tsx**: Import and wrap app with `AuthProvider` from `context/AuthContext.tsx` -- this is the critical login fix
2. **Per-username storage**: Create a `userStorage` utility that prefixes all localStorage keys with the current username. Update `localHistory.ts`, liked songs, mood prefs, last song, last search to use this utility
3. **pipedRecommendations.ts**: Replace sequential `for` loop with `Promise.any()` racing all instances simultaneously
4. **playerStore.ts**: Fix `addToQueue` to insert at `queueIndex + 1`; add `addNextInQueue` action
5. **Search.tsx**: Save search query to `userStorage` on submit; restore on mount
6. **playerStore.ts / App.tsx**: On mount, load last song from `userStorage` and restore it to store (paused); on song play, save to `userStorage`
7. **Sleep timer**: Add timer state (duration + start time) to a new `sleepTimerStore` or inside `playerStore`; add UI in `Settings.tsx` or `NowPlaying.tsx` showing timer options and countdown; call `setIsPlaying(false)` when timer expires
8. **Playlists**: Read `Library.tsx` and `SongCard.tsx` to find where Add to Playlist is triggered; ensure it calls `useAddSongToPlaylist` mutation correctly; add localStorage fallback for playlist data keyed by username
9. Validate and build
