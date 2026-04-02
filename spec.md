# Flute - Smart Auto-Recommendations & History

## Current State
- PlayerStore has a queue with `addToQueue` / `removeFromQueue` but no reordering
- NowPlaying has a Queue tab (list view) and a Related tab (uses old YouTube API with API key -- broken)
- History page exists as a standalone page using backend actor history
- Library page shows playlists and all cached songs
- No mood/preference learning system exists
- No skip feedback UI exists

## Requested Changes (Diff)

### Add
- **Auto-queue from Piped related streams**: When a song starts playing, fetch `GET /streams/:videoId` from Piped, extract `relatedStreams` array, classify each by mood from title keywords, filter by user preferences, and silently append to queue
- **Mood preference system (localStorage)**: Store `flute_mood_prefs` -- artist/mood scores that increase on "Listened" and decrease on "Not Interested"
- **Skip feedback UI**: When user skips or on queue items, show two inline action buttons: "Listened" (thumbs up) and "Not Interested" (thumbs down). Thumbs up = positive mood reinforcement. Thumbs down = reduce that artist/mood in future recommendations.
- **Queue reordering**: In the Queue tab of NowPlaying, allow moving items up/down or drag reorder. Add `reorderQueue` action to playerStore.
- **History tab in Library**: Add tab bar to Library page: "Playlists" | "History" tabs. History tab shows Spotify-style list with timestamps, limited to 100 entries, stored locally (keep using backend actor but cap display at 100).
- **Remove queue items**: Add remove button on queue items in NowPlaying Queue tab

### Modify
- **NowPlaying Related tab**: Replace broken YouTube API call with Piped `/streams/:videoId` relatedStreams fetch. No API key needed.
- **playerStore**: Add `reorderQueue(fromIndex, toIndex)` action
- **Auto-trigger**: In NowPlaying or a useEffect watching `currentSong`, auto-fetch recommendations and enqueue top 5 filtered songs if queue has < 3 songs after current

### Remove
- `fetchRelatedSongs` function in NowPlaying.tsx (uses old YouTube API)
- References to `localStorage.getItem('yt_api_key')` in NowPlaying related tab

## Implementation Plan
1. Add `reorderQueue` to playerStore
2. Create `src/utils/moodPrefs.ts` -- mood keyword classifier + localStorage preference read/write
3. Create `src/utils/pipedRecommendations.ts` -- fetches Piped relatedStreams, maps to Song[], scores by mood prefs
4. Update NowPlaying.tsx:
   - Replace Related tab with Piped-based recommendations
   - Add auto-queue useEffect (when currentSong changes, fetch related and enqueue)
   - Add skip feedback buttons (Listened / Not Interested) on queue and related items
   - Add reorder (up/down arrows) and remove button on queue items
5. Update Library.tsx: add Playlists / History tab switcher; History tab shows history list capped at 100, Spotify-style with timestamps
