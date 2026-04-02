# Flute

## Current State
Flute uses YouTube Data API v3 for all search, trending, and related song discovery. Users must configure a YouTube API key in Settings. The app shows a warning banner if no API key is set, and Meel fails entirely without one.

## Requested Changes (Diff)

### Add
- `src/frontend/src/lib/invidious.ts`: Invidious API client with multi-instance fallback. Provides `searchVideos(query)` and `fetchTrending()` functions. Uses public Invidious instances (inv.nadeko.net, invidious.privacydev.net, yt.artemislena.eu) with automatic fallback on failure.

### Modify
- `src/frontend/src/pages/Search.tsx`: Replace `searchYouTube()` (googleapis) with `searchVideos()` from invidious lib. Remove API key dependency. Remove API key error states.
- `src/frontend/src/pages/Meel.tsx`: Replace `fetchMeelTracks()` (googleapis) with Invidious trending + genre search. Remove API key check. Remove "no_api_key" error state.
- `src/frontend/src/components/Player/YouTubePlayer.tsx`: Replace `fetchAndPlayRelated()` (googleapis) with `searchVideos()` from invidious lib. Remove API key dependency.
- `src/frontend/src/App.tsx`: Remove `ApiKeyBanner` component. Remove apiKey check for banner display.
- `src/frontend/src/pages/Settings.tsx`: Remove the API key input, Test button, and related state/logic entirely.

### Remove
- All `localStorage.getItem('yt_api_key')` references
- All `googleapis.com/youtube/v3` fetch calls

## Implementation Plan
1. Create `src/frontend/src/lib/invidious.ts` with typed Invidious API wrapper and instance fallback logic
2. Update `Search.tsx` to use the new lib
3. Update `Meel.tsx` to use the new lib
4. Update `YouTubePlayer.tsx` to use the new lib
5. Update `App.tsx` to remove the API key banner
6. Update `Settings.tsx` to remove the API key section
7. Validate (typecheck + build)
