# Flute – Meel Feature + Full App Overhaul

## Current State
- React + TypeScript frontend with Spotify-like dark UI (desktop-first)
- Sidebar navigation (desktop) with pages: Home, Search, Library, Liked, History, Settings, NowPlaying
- YouTube IFrame API powers hidden audio-only playback via `YouTubePlayer.tsx`
- `playerStore` (Zustand) manages queue, current song, play/pause, progress, volume
- `navigationStore` manages page routing
- Songs are YouTube videos fetched via YouTube Data API v3
- Backend (ICP/Motoko) handles playlists, liked songs, history, user profile
- Search uses `videoCategoryId: 10` but does not filter by title keywords
- No Meel/Reels feature
- No mood buttons
- No endless radio
- No bottom nav bar (desktop sidebar only)
- No mobile-first layout

## Requested Changes (Diff)

### Add
- **Meel page** (`src/frontend/src/pages/Meel.tsx`): Full-screen vertical scroll feed (TikTok/Reels style). Each card fills 100vh. YouTube IFrame API embedded visibly as full-screen background (object-fit: cover). Playback starts at 60s (`startSeconds: 60`), auto-advances after 45s (`endSeconds: 105`). Each card shows song title + artist bottom-left with a spinning record icon (CSS animation). "Add to Playlist" button on-screen. Fetch trending music using `chart: mostPopular`, `videoCategoryId: 10`, with genre matching from localStorage (`flute_favorite_genres`). Filter out videos < 2 minutes duration.
- **Meel tab** in navigation (both sidebar and bottom nav)
- **Bottom navigation bar** (mobile-first): Home, Search, Meel, Library, NowPlaying tabs. Visible on all screen sizes as primary nav on mobile. Replaces sidebar role on small screens.
- **Mood buttons row** on Home page: Deep Focus, Gym Beast, Midnight Chill, High Energy. Each triggers a hidden search query.
- **Endless Radio**: When a song ends (onStateChange === 0), if repeat is "none", fetch `relatedToVideoId` filtered to `videoCategoryId: 10` and auto-play the first valid result instead of stopping.
- **Smart music filtering utility**: All YouTube search calls append `official audio` OR `high quality music` to query. Filter out results with 'live', 'reaction', 'cover', 'vlog' in title (case-insensitive). Min duration 2 minutes for Meel.
- **Meel YouTube player**: A second YouTube IFrame player embedded visibly inside Meel cards (full-screen video background). Uses `playerVars: { startSeconds: 60, endSeconds: 105, autoplay: 1, controls: 0, mute: 0 }`.

### Modify
- **`App.tsx`**: Add `meel` to page routing. Switch from sidebar-only layout to mobile-first layout with bottom nav. On mobile, hide sidebar; show bottom nav instead.
- **`navigationStore.ts`**: Add `"meel"` to `Page` type.
- **`Sidebar.tsx`**: Add Meel nav item. On mobile (< lg), hide sidebar entirely.
- **`YouTubePlayer.tsx`**: Implement Endless Radio — on song end, fetch related videos filtered to music category, auto-play next instead of calling `next()` when queue ends.
- **`Search.tsx`**: Update `searchYouTube()` to append `official audio` to queries, filter title keywords (live/reaction/cover/vlog).
- **`Home.tsx`**: Add Mood buttons row (Deep Focus → 'Lofi study music long play', Gym Beast → 'Aggressive Phonk music', Midnight Chill → 'Midnight chill RnB slow', High Energy → 'High energy EDM workout').
- **`PlayerBar.tsx`**: Keep for desktop. On mobile, hide or collapse to minimal floating bar above bottom nav.
- **`index.css`**: Ensure `color-scheme: dark` and mobile viewport meta support.

### Remove
- Nothing removed, only extended.

## Implementation Plan
1. Update `navigationStore.ts` to add `"meel"` page type
2. Create `src/frontend/src/pages/Meel.tsx` with:
   - Vertical snap-scroll container (scroll-snap-type: y mandatory)
   - Each item: full-screen div (h-screen, scroll-snap-align: start)
   - Visible YouTube iframe as background (pointer-events: none, object-fit cover via wrapper + iframe transform)
   - Overlay: bottom-left song info + spinning record icon, right side Add to Playlist button
   - Fetch trending music with genre affinity from localStorage
   - Filter < 2min duration, filter title keywords
   - Auto-advance after 45s using setInterval watching currentTime
   - Use Intersection Observer to detect active card and load/play it
3. Update `App.tsx`:
   - Add `meel` case to page router
   - Add `BottomNav` component (Home, Search, Meel, Library, NowPlaying icons)
   - Mobile layout: `flex-col`, sidebar hidden on mobile, bottom nav fixed at bottom
4. Update `Sidebar.tsx`: add Meel item, hide on `lg:hidden` on mobile
5. Update `Search.tsx`: smart filtering in `searchYouTube()`
6. Update `Home.tsx`: add Mood buttons row
7. Update `YouTubePlayer.tsx`: endless radio on song end
8. Validate and fix any TypeScript/lint errors
