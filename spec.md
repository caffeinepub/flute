# Flute

## Current State
New project. Only scaffold files exist (empty Motoko actor, no frontend).

## Requested Changes (Diff)

### Add
- **User authentication** -- sign-in required to access the app; each user has their own data
- **YouTube search** -- search songs by name via YouTube Data API (API key configured in app); results show title, thumbnail, channel
- **Music player** -- Spotify-style player bar at bottom; hidden YouTube iframe plays audio only; controls: play/pause, previous/next, seek bar, volume, shuffle, repeat
- **Queue management** -- current queue panel; add/remove/reorder songs; auto-advance to next song
- **Similar/recommended songs** -- displayed alongside now-playing; pulled from YouTube related videos
- **Playlists** -- create, rename, delete playlists; add/remove songs; reorder songs in playlist
- **Liked songs** -- heart/like button on any song; dedicated Liked Songs view
- **Listening history** -- auto-log recently played songs per user
- **Lyrics panel** -- fetch lyrics from lyrics API (via HTTP outcall) when a song loads; display in sliding panel
- **Offline metadata cache** -- after playing a song, cache title, thumbnail, channel, lyrics in backend so repeat plays are fast and metadata survives offline
- **Home/browse screen** -- trending/popular placeholder, recently played, quick picks based on history

### Modify
- Nothing (new project)

### Remove
- Nothing

## Implementation Plan
1. Backend (Motoko):
   - User data store keyed by principal: liked songs, playlists, history, cached song metadata
   - CRUD for playlists and liked songs
   - Song metadata cache (videoId -> {title, thumbnail, channel, lyrics})
   - History recording (add to front, cap at 50)
   - HTTP outcall to lyrics API (e.g. lyrics.ovh) by song title + artist
   - Expose query/update functions for all above

2. Frontend (React/TypeScript):
   - Auth gate (sign-in screen if not logged in)
   - Sidebar: Home, Search, Your Library (playlists), Liked Songs, History
   - Main content area: Search results / Playlist view / Liked Songs / History / Home
   - Bottom player bar: thumbnail, title, controls, seek, volume, heart
   - Hidden YouTube iframe for playback
   - Queue drawer (slide-up or right panel)
   - Lyrics panel (slide-in from right)
   - Similar songs shown in now-playing expanded view
   - YouTube API key input in Settings (stored in localStorage)
   - Spotify-dark visual design: near-black background, green accents
