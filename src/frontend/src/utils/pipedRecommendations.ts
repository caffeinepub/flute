import type { Song } from "../types/song";
import { scoreTrack } from "./moodPrefs";

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.yt",
  "https://piped-api.privacy.com.de",
  "https://api.piped.projectsegfau.lt",
  "https://pipedapi.adminforge.de",
  "https://piped.drgns.space",
  "https://api.piped.private.coffee",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.coldmilk.com",
];

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DURATION = 480; // 8 minutes
const MIN_DURATION = 60; // 1 minute
// ISSUE 1 FIX: hard cap per uploader across the entire results list (not just consecutive)
const MAX_PER_UPLOADER = 2;

const REJECT_KEYWORDS = [
  "short",
  "clip",
  "interview",
  "reaction",
  "episode",
  "podcast",
];
const PREFER_KEYWORDS = ["official", "audio", "song", "lyrics", "music"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Robust video ID extractor — handles all Piped URL formats
 */
function getVideoId(url: string): string {
  if (!url) return "";
  const qMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (qMatch) return qMatch[1];
  const watchMatch = url.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const pathMatch = url.match(/\/([a-zA-Z0-9_-]{11})(?:[?&#]|$)/);
  if (pathMatch) return pathMatch[1];
  return "";
}

/**
 * Returns true if the track should be REJECTED.
 */
function isBadTrack(title: string, duration: number): boolean {
  if (!duration || duration <= MIN_DURATION) return true;
  if (duration > MAX_DURATION) return true;
  const lower = title.toLowerCase();
  if (REJECT_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  return false;
}

/**
 * Similarity scoring — higher score = more relevant.
 */
function scoreSimilarity(
  title: string,
  uploader: string,
  currentTitle: string,
  currentUploader: string,
): number {
  let score = 0;
  const titleLower = title.toLowerCase();
  const currentUploaderLower = currentUploader.toLowerCase().trim();
  const uploaderLower = uploader.toLowerCase().trim();

  if (
    uploaderLower === currentUploaderLower &&
    currentUploaderLower.length > 0
  ) {
    score += 40;
  }

  const currentWords = currentTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const titleWords = new Set(
    titleLower.split(/\s+/).filter((w) => w.length >= 3),
  );
  const sharedCount = currentWords.filter((w) => titleWords.has(w)).length;
  if (sharedCount >= 1) score += 25;

  if (titleLower.includes("official") || titleLower.includes("audio")) {
    score += 15;
  }

  if (PREFER_KEYWORDS.some((kw) => titleLower.includes(kw))) {
    score += 5;
  }

  if (titleLower.includes("remix")) score -= 30;

  if (
    titleLower.includes("live") ||
    titleLower.includes("concert") ||
    titleLower.includes("short")
  ) {
    score -= 50;
  }

  return score;
}

interface PipedRelatedStream {
  url: string;
  title: string;
  uploaderName: string;
  thumbnail: string;
  duration: number;
  type?: string;
}

// Cache results per videoId to avoid refetch
const relatedCache = new Map<string, Song[]>();

/**
 * Try to re-fetch duration for a broken (0-duration) song from any Piped instance.
 * ISSUE 3 FIX: used both in filterAndMap and in YouTubePlayer retry logic.
 */
export async function refetchStreamData(
  videoId: string,
): Promise<{ duration: number; streamUrl: string } | null> {
  try {
    const result = await Promise.any(
      PIPED_INSTANCES.map(async (instance) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(`${instance}/streams/${videoId}`, {
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const dur = data?.duration as number | undefined;
          if (!dur || dur <= 0) throw new Error("no duration");
          // Pick best audio stream
          const streams: Array<{
            url: string;
            bitrate: number;
            mimeType: string;
          }> = data?.audioStreams ?? [];
          if (streams.length === 0) throw new Error("no streams");
          const sorted = [...streams].sort(
            (a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0),
          );
          const mp4 = sorted.find((s) => s.mimeType?.includes("audio/mp4"));
          const webm = sorted.find((s) => s.mimeType?.includes("audio/webm"));
          const best = mp4 ?? webm ?? sorted[0];
          return { duration: dur, streamUrl: best.url };
        } catch (e) {
          clearTimeout(timer);
          throw e;
        }
      }),
    );
    return result;
  } catch {
    return null;
  }
}

async function refetchDuration(videoId: string): Promise<number> {
  const data = await refetchStreamData(videoId);
  return data?.duration ?? 0;
}

/**
 * Fetch from a single instance and VALIDATE before accepting.
 * ISSUE 4 FIX: Only accepts if relatedStreams.length >= 5.
 */
async function fetchAndValidate(
  instance: string,
  videoId: string,
): Promise<PipedRelatedStream[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${instance}/streams/${videoId}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const related: PipedRelatedStream[] = (data.relatedStreams || []).filter(
      (s: PipedRelatedStream) => s.type !== "channel" && s.type !== "playlist",
    );

    if (related.length < 5) throw new Error("insufficient results");

    return related;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * ISSUE 1 FIX — Hard cap of MAX_PER_UPLOADER (2) per uploader across the ENTIRE list.
 *
 * Algorithm:
 * 1. Score and sort all candidates
 * 2. Apply strict per-uploader cap of 2 total
 * 3. Build final list: up to 2 same-artist first, then diverse others
 * 4. If after diversity filtering the list is short, allow same-artist to fill
 */
async function filterAndMap(
  related: PipedRelatedStream[],
  currentTitle: string,
  currentUploader: string,
  excludeId?: string,
): Promise<Song[]> {
  const seen = new Set<string>();
  if (excludeId) seen.add(excludeId);

  interface ScoredCandidate {
    videoId: string;
    title: string;
    channel: string;
    thumbnail: string;
    rawDuration: number;
    score: number;
    isSameArtist: boolean;
  }

  const candidates: ScoredCandidate[] = [];

  for (const s of related) {
    const vid = getVideoId(s.url);
    if (!vid || vid.length !== 11) continue;
    if (seen.has(vid)) continue;
    seen.add(vid);

    let dur = s.duration;

    // ISSUE 3 FIX: if duration is 0 or missing, try re-fetching before discarding
    if (!dur || dur <= 0) {
      dur = await refetchDuration(vid);
    }

    // Filter out bad tracks (still 0, shorts, podcasts, >8 min)
    if (isBadTrack(s.title || "", dur)) continue;

    const uploaderLower = (s.uploaderName || "").toLowerCase().trim();
    const currentUploaderLower = currentUploader.toLowerCase().trim();
    const isSameArtist =
      uploaderLower === currentUploaderLower && currentUploaderLower.length > 0;

    const score = scoreSimilarity(
      s.title || "",
      s.uploaderName || "",
      currentTitle,
      currentUploader,
    );

    candidates.push({
      videoId: vid,
      title: s.title || "",
      channel: s.uploaderName || "",
      thumbnail: s.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      rawDuration: dur,
      score,
      isSameArtist,
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // ISSUE 1 FIX: strict per-uploader hard cap across the entire list
  // Track global count per uploader key
  const uploaderCount = new Map<string, number>();

  const sameArtistPicks: ScoredCandidate[] = [];
  const otherArtistPicks: ScoredCandidate[] = [];

  for (const c of candidates) {
    const key = c.channel.toLowerCase().trim();
    const count = uploaderCount.get(key) ?? 0;
    // Hard cap: max MAX_PER_UPLOADER songs from any single uploader
    if (count >= MAX_PER_UPLOADER) continue;
    uploaderCount.set(key, count + 1);

    if (c.isSameArtist) {
      sameArtistPicks.push(c);
    } else {
      otherArtistPicks.push(c);
    }
  }

  // Build final list: up to 2 same-artist first, then fill with others
  const finalList: ScoredCandidate[] = [
    ...sameArtistPicks.slice(0, MAX_PER_UPLOADER),
    ...otherArtistPicks,
  ].slice(0, 20);

  // Apply mood score for final ordering of the "others" section
  return finalList
    .sort(
      (a, b) => scoreTrack(b.title, b.channel) - scoreTrack(a.title, a.channel),
    )
    .slice(0, 20)
    .map((c) => ({
      videoId: c.videoId,
      title: c.title,
      channel: c.channel,
      thumbnail: c.thumbnail,
      duration: formatDuration(c.rawDuration),
    }));
}

/**
 * Smart fallback: search using track metadata instead of original query.
 * ISSUE 4 FIX: Never uses original search query — always title+uploader.
 */
async function smartFallbackSearch(
  title: string,
  uploader: string,
  currentUploader: string,
  variant = 0,
): Promise<Song[]> {
  const queries = [
    `${title} ${uploader} official audio`,
    `${title} ${uploader}`,
    `${title} remix`,
    `${title} song`,
    `${title} playlist`,
  ];
  const query = queries[variant] || queries[0];
  const encoded = encodeURIComponent(query);

  try {
    const result = await Promise.any(
      PIPED_INSTANCES.map(async (instance) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(
            `${instance}/search?q=${encoded}&filter=music_songs`,
            { signal: controller.signal },
          );
          clearTimeout(timer);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const items = (data?.items || []) as PipedRelatedStream[];
          if (items.length === 0) throw new Error("empty");
          return items;
        } catch (err) {
          clearTimeout(timer);
          throw err;
        }
      }),
    );
    const songs = await filterAndMap(result, title, currentUploader);
    if (songs.length === 0) throw new Error("empty after filter");
    return songs;
  } catch {
    return [];
  }
}

/**
 * Main export: fetch similar/related songs for a given videoId.
 *
 * Pipeline:
 * 1. Parallel fetch + validation (min 5 relatedStreams) — ISSUE 4
 * 2. Music-only filter (reject shorts/podcasts/interviews, >8 min, <1 min)
 * 3. Similarity scoring (+40 same artist, +25 shared keywords, etc.)
 * 4. Artist diversity — hard cap of 2 per uploader total — ISSUE 1
 * 5. Smart fallback search (title + uploader, NEVER original search query)
 * 6. Broaden query variants if still empty
 */
export async function fetchRelatedSongs(
  videoId: string,
  songTitle?: string,
  songUploader?: string,
  // ISSUE 5 FIX: pass session-played IDs to exclude already-heard songs
  excludeIds?: Set<string>,
): Promise<Song[]> {
  if (!videoId) return [];

  // Return from cache if available (but apply excludeIds filter on top)
  if (relatedCache.has(videoId)) {
    const cached = relatedCache.get(videoId)!;
    if (!excludeIds || excludeIds.size === 0) return cached;
    const filtered = cached.filter((s) => !excludeIds.has(s.videoId));
    if (filtered.length > 0) return filtered;
    // If cache is exhausted by excludeIds, fall through to re-fetch
    relatedCache.delete(videoId);
  }

  const uploader = songUploader || "";
  const title = songTitle || "";

  // Step 1: Try relatedStreams from all instances with validation
  let songs: Song[] = [];
  try {
    const rawStreams = await Promise.any(
      PIPED_INSTANCES.map((instance) => fetchAndValidate(instance, videoId)),
    );
    songs = await filterAndMap(rawStreams, title, uploader, videoId);
  } catch {
    songs = [];
  }

  // Step 2: Smart fallback search if relatedStreams failed
  if (songs.length === 0 && title) {
    songs = await smartFallbackSearch(title, uploader, uploader, 0);
  }

  // Step 3: Broaden query if still empty
  if (songs.length === 0 && title) {
    for (let variant = 2; variant <= 4 && songs.length === 0; variant++) {
      songs = await smartFallbackSearch(title, uploader, uploader, variant);
    }
  }

  // Apply session exclusion filter
  if (excludeIds && excludeIds.size > 0) {
    songs = songs.filter((s) => !excludeIds.has(s.videoId));
  }

  // Cache and return
  if (songs.length > 0) {
    relatedCache.set(videoId, songs);
  }

  return songs;
}

/**
 * Invalidate cache for a specific videoId (useful when retrying).
 */
export function invalidateRelatedCache(videoId: string): void {
  relatedCache.delete(videoId);
}
