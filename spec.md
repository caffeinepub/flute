# Flute — PWA + Similar Songs + Login Removal

## Current State
- Flute is a mobile-first Spotify-style music player using Piped API
- Has a local login system (username + guest mode) gating the app behind a sign-in page
- Similar Songs tab fetches relatedStreams from Piped but: accepts first response blindly even if empty/incomplete, uses no validation, has queue contamination (similar songs auto-added to queue), shows 00:00 duration tracks, has no deduplication, and falls back to original search query instead of track metadata
- Queue can loop the same song because auto-fill uses original search query
- No PWA support (no manifest.json, no service worker, no install prompt)
- main.tsx wraps with InternetIdentityProvider but NOT AuthProvider — login breaks on every update
- Icons: 4 sizes generated at /assets/generated/flute-icon-*.png

## Requested Changes (Diff)

### Add
- manifest.json in public/ with name "Flute", display standalone, portrait, black colors, all 4 icon sizes
- service-worker.js in public/ with cache-first for static assets, network-only for API/stream URLs
- Register service worker in main.tsx
- PWA meta tags in index.html (theme-color, apple-mobile-web-app, viewport)
- Install App button: hook into beforeinstallprompt, show "Install Flute" button, hide after install
- Install button placed in Settings page and/or BottomNav
- Smart fallback search in pipedRecommendations.ts using `title + " " + uploader` (never original query)
- Three-tier fallback: 1) relatedStreams (min 5 valid), 2) smart search, 3) broad query variants
- Deduplication by videoId across relatedSongs results
- Cache relatedSongs per videoId to avoid refetch

### Modify
- Remove SignInPage component from App.tsx — skip login entirely, always render MainLayout
- Remove `if (!user) return <SignInPage />` guard from App() in App.tsx
- App.tsx: import AuthProvider from context, wrap everything properly (or just skip auth check)
- main.tsx: Add AuthProvider wrapper (permanent fix)
- pipedRecommendations.ts: Full rewrite of fetchRelatedSongs:
  - Use Promise.any() but validate EACH response before accepting (relatedStreams.length >= 5)
  - Implement validation race: Promise.any(instances.map(i => fetchAndValidate(i, videoId)))
  - Filter: duration > 30 seconds, valid videoId (11 chars), non-null URL
  - Deduplicate by videoId
  - Smart fallback: if all fail, search `title + " " + uploader + " official audio"`
  - Broad fallback: if smart search fails, try `title + " remix"`, `title + " song"`
  - Cache results per videoId in a Map
- NowPlaying.tsx: Remove the auto-add-to-queue logic from loadRelated (lines that call addToQueue). Similar Songs and Queue must be COMPLETELY SEPARATE. Similar Songs only displays; never auto-pollutes queue.
- NowPlaying.tsx: Filter relatedSongs display to never show 00:00 (duration must be > 30s string-parsed)
- index.html: Add PWA meta tags, manifest link, theme-color

### Remove
- SignInPage component (entire function) from App.tsx
- Login guard from App() export
- Auth-related imports no longer needed in App.tsx (useLocalAuth)
- The auto-queue-fill block from NowPlaying.tsx's loadRelated callback

## Implementation Plan
1. Write manifest.json → src/frontend/public/manifest.json (references generated icon paths)
2. Write service-worker.js → src/frontend/public/service-worker.js
3. Update src/frontend/index.html with PWA meta tags + manifest link
4. Update src/frontend/src/main.tsx: add AuthProvider wrapper + SW registration
5. Rewrite src/frontend/src/utils/pipedRecommendations.ts with full validation pipeline
6. Update src/frontend/src/App.tsx: remove SignInPage, remove login guard, keep MainLayout
7. Update src/frontend/src/pages/NowPlaying.tsx: remove auto-queue-fill, keep similar songs display
8. Update src/frontend/src/pages/Settings.tsx: add Install App button
9. Validate + deploy
