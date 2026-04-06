import type { Song } from "../backend";
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

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Robust video ID extractor -- handles all Piped URL formats
 */
function getVideoId(url: string): string {
  if (!url) return "";
  const qMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (qMatch) return qMatch[1];
  const pathMatch = url.match(/\/([a-zA-Z0-9_-]{11})(?:[?&#]|$)/);
  if (pathMatch) return pathMatch[1];
  return "";
}

interface PipedRelatedStream {
  url: string;
  title: string;
  uploaderName: string;
  thumbnail: string;
  duration: number;
}

// Cache results per videoId to avoid refetch
const relatedCache = new Map<string, Song[]>();

/**
 * Fetch from a single instance and VALIDATE before accepting.
 * Only accepts if relatedStreams.length >= 5 with valid entries.
 */
async function fetchAndValidate(
  instance: string,
  videoId: string,
): Promise<Song[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${instance}/streams/${videoId}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const related: PipedRelatedStream[] = data.relatedStreams || [];

    // VALIDATION: must have at least 5 entries before accepting
    if (related.length < 5) throw new Error("insufficient results");

    const songs = filterAndMap(related, videoId);
    if (songs.length < 3)
      throw new Error("too few valid songs after filtering");

    return songs;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Filter, map and deduplicate a list of related streams into Song objects.
 */
function filterAndMap(
  related: PipedRelatedStream[],
  excludeId?: string,
): Song[] {
  const seen = new Set<string>();
  if (excludeId) seen.add(excludeId);

  return related
    .filter((s) => s.duration > 30) // remove shorts and 0-duration
    .map((s) => {
      const vid = getVideoId(s.url);
      return {
        videoId: vid,
        title: s.title || "",
        channel: s.uploaderName || "",
        thumbnail: s.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        duration: formatDuration(s.duration),
      };
    })
    .filter((s) => {
      if (s.videoId.length !== 11) return false;
      if (seen.has(s.videoId)) return false;
      seen.add(s.videoId);
      return true;
    })
    .sort(
      (a, b) => scoreTrack(b.title, b.channel) - scoreTrack(a.title, a.channel),
    )
    .slice(0, 20);
}

/**
 * Smart fallback: search using track metadata instead of original query.
 * Never use the original search query -- always build from title + uploader.
 */
async function smartFallbackSearch(
  title: string,
  uploader: string,
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
          const songs = filterAndMap(items);
          if (songs.length === 0) throw new Error("empty");
          return songs;
        } catch (err) {
          clearTimeout(timer);
          throw err;
        }
      }),
    );
    return result;
  } catch {
    return [];
  }
}

/**
 * Main export: fetch similar/related songs for a given videoId.
 *
 * Strategy:
 * 1. Try relatedStreams from all Piped instances (validated, min 5 entries)
 * 2. If all fail → smart search using title + uploader
 * 3. If still empty → broaden query with variants
 *
 * Queue and Similar Songs are COMPLETELY SEPARATE -- this function only
 * populates the Similar Songs tab; callers must NOT add these to the queue.
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

  // Step 1: Try relatedStreams from all instances with validation
  let songs: Song[] = [];
  try {
    songs = await Promise.any(
      PIPED_INSTANCES.map((instance) => fetchAndValidate(instance, videoId)),
    );
  } catch {
    // All instances failed or returned insufficient data
    songs = [];
  }

  // Step 2: Smart fallback search if relatedStreams failed
  if (songs.length === 0 && songTitle) {
    const uploader = songUploader || "";
    songs = await smartFallbackSearch(songTitle, uploader, 0);
  }

  // Step 3: Broaden query if still empty
  if (songs.length === 0 && songTitle) {
    for (let variant = 2; variant <= 4 && songs.length === 0; variant++) {
      songs = await smartFallbackSearch(songTitle, songUploader || "", variant);
    }
  }

  // Cache and return
  if (songs.length > 0) {
    relatedCache.set(videoId, songs);
  }

  return songs;
}
