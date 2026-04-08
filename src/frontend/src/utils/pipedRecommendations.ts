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
 * FIX 1 — Music-only filter.
 * Returns true if the track should be REJECTED.
 */
function isBadTrack(title: string, duration: number): boolean {
  // Duration checks
  if (!duration || duration <= MIN_DURATION) return true;
  if (duration > MAX_DURATION) return true;

  const lower = title.toLowerCase();
  // Reject if contains any reject keyword
  if (REJECT_KEYWORDS.some((kw) => lower.includes(kw))) return true;

  return false;
}

/**
 * FIX 2 — Similarity scoring system.
 * Higher score = more relevant.
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

  // +40 if same artist
  if (
    uploaderLower === currentUploaderLower &&
    currentUploaderLower.length > 0
  ) {
    score += 40;
  }

  // +25 if title shares main keywords (3+ char words)
  const currentWords = currentTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const titleWords = new Set(
    titleLower.split(/\s+/).filter((w) => w.length >= 3),
  );
  const sharedCount = currentWords.filter((w) => titleWords.has(w)).length;
  if (sharedCount >= 1) score += 25;

  // +15 if title contains "official" or "audio"
  if (titleLower.includes("official") || titleLower.includes("audio")) {
    score += 15;
  }

  // Prefer keywords bonus
  if (PREFER_KEYWORDS.some((kw) => titleLower.includes(kw))) {
    score += 5;
  }

  // -30 if remix
  if (titleLower.includes("remix")) score -= 30;

  // -50 if live, concert, short
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
 */
async function refetchDuration(videoId: string): Promise<number> {
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
          return dur;
        } catch (e) {
          clearTimeout(timer);
          throw e;
        }
      }),
    );
    return result;
  } catch {
    return 0;
  }
}

/**
 * Fetch from a single instance and VALIDATE before accepting.
 * Only accepts if relatedStreams.length >= 5 with valid entries.
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

    // VALIDATION: must have at least 5 stream entries before accepting
    if (related.length < 5) throw new Error("insufficient results");

    return related;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * FIX 3 — Filter, score, and apply artist diversity.
 *
 * Pipeline:
 * 1. Music-only filter (FIX 1)
 * 2. Similarity scoring (FIX 2)
 * 3. Artist diversity — interleave same/other artists (FIX 3)
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

    // If duration is 0 or missing, try re-fetching
    if (!dur || dur <= 0) {
      dur = await refetchDuration(vid);
    }

    // FIX 1 — music-only filter (also catches 8-min cap)
    if (isBadTrack(s.title || "", dur)) continue;

    const uploaderLower = (s.uploaderName || "").toLowerCase().trim();
    const currentUploaderLower = currentUploader.toLowerCase().trim();
    const isSameArtist =
      uploaderLower === currentUploaderLower && currentUploaderLower.length > 0;

    // FIX 2 — compute similarity score
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

  // FIX 3 — Artist diversity: separate same/other artists
  const sameArtist = candidates.filter((c) => c.isSameArtist);
  const otherArtists = candidates.filter((c) => !c.isSameArtist);

  // Per-uploader cap in otherArtists: max 2 from any single uploader
  const uploaderCount = new Map<string, number>();
  const diverseOthers = otherArtists.filter((c) => {
    const key = c.channel.toLowerCase().trim();
    const count = uploaderCount.get(key) ?? 0;
    if (count >= 2) return false;
    uploaderCount.set(key, count + 1);
    return true;
  });

  // Interleave: max 2 consecutive same-artist in the first 4 results,
  // then alternate so it stays diverse. Same artist CAN reappear after position 4.
  const merged: ScoredCandidate[] = [];
  let sameIdx = 0;
  let otherIdx = 0;
  let consecutiveSame = 0;

  while (
    merged.length < 20 &&
    (sameIdx < sameArtist.length || otherIdx < diverseOthers.length)
  ) {
    // Enforce: if 2 consecutive same-artist, force an other-artist next
    if (consecutiveSame >= 2 && otherIdx < diverseOthers.length) {
      merged.push(diverseOthers[otherIdx++]);
      consecutiveSame = 0;
    } else if (
      sameIdx < sameArtist.length &&
      merged.length < 2 // first 2 slots prefer same artist
    ) {
      merged.push(sameArtist[sameIdx++]);
      consecutiveSame++;
    } else if (otherIdx < diverseOthers.length) {
      merged.push(diverseOthers[otherIdx++]);
      consecutiveSame = 0;
      // After filling others, allow more same-artist
    } else if (sameIdx < sameArtist.length) {
      merged.push(sameArtist[sameIdx++]);
      consecutiveSame++;
    } else {
      break;
    }
  }

  // Apply mood score on top and cap at 20
  return merged
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
 * 1. Parallel fetch + validation (min 5 relatedStreams)
 * 2. Music-only filter (reject shorts/podcasts/interviews, >8 min, <1 min)
 * 3. Similarity scoring (+40 same artist, +25 shared keywords, etc.)
 * 4. Artist diversity (max 2 consecutive same artist, interleaved)
 * 5. Smart fallback search (title + uploader, NEVER original search query)
 * 6. Broaden query variants if still empty
 */
export async function fetchRelatedSongs(
  videoId: string,
  songTitle?: string,
  songUploader?: string,
): Promise<Song[]> {
  if (!videoId) return [];

  // Return from cache if available
  if (relatedCache.has(videoId)) {
    return relatedCache.get(videoId)!;
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
