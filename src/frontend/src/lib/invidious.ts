import type { Song } from "../backend";

// Piped is a CORS-enabled YouTube alternative API
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

export interface InvidiousVideo {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: number;
  videoThumbnails: Array<{ quality: string; url: string }>;
}

interface PipedItem {
  url: string;
  title: string;
  uploaderName: string;
  duration: number;
  thumbnail: string;
  type?: string;
}

interface PipedAudioStream {
  url: string;
  bitrate: number;
  mimeType: string;
  quality?: string;
}

interface PipedStreamsResponse {
  audioStreams: PipedAudioStream[];
  title?: string;
  uploader?: string;
  thumbnailUrl?: string;
  duration?: number;
  relatedStreams?: PipedItem[];
}

function pipedToInvidious(item: PipedItem): InvidiousVideo | null {
  const match =
    item.url?.match(/[?&]v=([^&]+)/) ||
    item.url?.match(/\/watch\?v=([^&]+)/) ||
    item.url?.match(/\/([a-zA-Z0-9_-]{11})$/);
  if (!match) return null;
  const videoId = match[1];
  return {
    videoId,
    title: item.title || "",
    author: item.uploaderName || "",
    lengthSeconds: item.duration || 0,
    videoThumbnails: [
      {
        quality: "high",
        url:
          item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      },
    ],
  };
}

// Helper: fetch from a single instance with timeout
function fetchFromInstance(instance: string, path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(`${instance}${path}`, { signal: controller.signal })
    .then((res) => {
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<unknown>;
    })
    .catch((err) => {
      clearTimeout(timer);
      throw err;
    });
}

// Race all instances in parallel -- FIRST success wins (true Promise.any behavior)
export async function pipedFetch(path: string): Promise<unknown> {
  try {
    return await Promise.any(
      PIPED_INSTANCES.map((instance) => fetchFromInstance(instance, path)),
    );
  } catch {
    throw new Error(
      "All Piped instances failed. Check your internet connection.",
    );
  }
}

// For search: race all instances, pick first with non-empty results
async function pipedSearchFetch(path: string): Promise<{ items: PipedItem[] }> {
  try {
    const result = await Promise.any(
      PIPED_INSTANCES.map((instance) =>
        fetchFromInstance(instance, path).then((data) => {
          const d = data as { items: PipedItem[] };
          const filtered = (d?.items ?? []).filter(
            (item) => item.type !== "channel" && item.type !== "playlist",
          );
          if (filtered.length === 0) throw new Error("empty");
          return d;
        }),
      ),
    );
    return result as { items: PipedItem[] };
  } catch {
    throw new Error(
      "Can't connect to music service. Check your internet connection and try again.",
    );
  }
}

/**
 * Fetch the best audio stream URL for a video.
 * Races all instances -- returns the first working stream URL.
 */
export async function getStreamUrl(
  videoId: string,
): Promise<{ url: string; duration: number }> {
  const data = (await pipedFetch(
    `/streams/${videoId}`,
  )) as PipedStreamsResponse;
  const streams = data?.audioStreams ?? [];
  if (streams.length === 0) throw new Error("No audio streams found");

  // Prefer mp4 (most compatible), then webm, sorted by bitrate descending
  const sorted = [...streams].sort(
    (a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0),
  );
  const mp4 = sorted.find((s) => s.mimeType?.includes("audio/mp4"));
  const webm = sorted.find((s) => s.mimeType?.includes("audio/webm"));
  const best = mp4 ?? webm ?? sorted[0];
  return { url: best.url, duration: data.duration ?? 0 };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const BLOCKED = ["live", "reaction", "vlog"];
function isMusic(title: string, secs: number): boolean {
  if (secs < 90) return false;
  const lower = title.toLowerCase();
  return !BLOCKED.some((kw) => lower.includes(kw));
}

function toSong(v: InvidiousVideo): Song | null {
  if (!isMusic(v.title, v.lengthSeconds)) return null;
  const thumb =
    v.videoThumbnails.find((t) => t.quality === "high") || v.videoThumbnails[0];
  return {
    videoId: v.videoId,
    title: v.title,
    channel: v.author,
    thumbnail:
      thumb?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    duration: formatDuration(v.lengthSeconds),
  };
}

export async function searchVideos(query: string): Promise<Song[]> {
  const q = encodeURIComponent(`${query} official audio`);
  const data = await pipedSearchFetch(`/search?q=${q}&filter=videos`);

  const items = data?.items ?? [];
  return items
    .filter((item) => item.type !== "channel" && item.type !== "playlist")
    .map((item) => {
      const inv = pipedToInvidious(item);
      return inv ? toSong(inv) : null;
    })
    .filter((s): s is Song => s !== null)
    .slice(0, 20);
}

export async function fetchTrending(genres: string[] = []): Promise<Song[]> {
  const [trending, ...genreResults] = await Promise.allSettled([
    pipedFetch("/trending?region=US") as Promise<PipedItem[]>,
    ...genres
      .slice(0, 3)
      .map(
        (g) =>
          pipedFetch(
            `/search?q=${encodeURIComponent(`${g} official audio`)}&filter=videos`,
          ) as Promise<{ items: PipedItem[] }>,
      ),
  ]);

  const allItems: PipedItem[] = [];
  if (trending.status === "fulfilled") {
    allItems.push(...(Array.isArray(trending.value) ? trending.value : []));
  }
  for (const r of genreResults) {
    if (r.status === "fulfilled") {
      const val = r.value as { items: PipedItem[] };
      allItems.push(...(val?.items ?? []));
    }
  }

  const seen = new Set<string>();
  const songs: Song[] = [];
  for (const item of allItems) {
    const inv = pipedToInvidious(item);
    if (!inv || seen.has(inv.videoId)) continue;
    seen.add(inv.videoId);
    const s = toSong(inv);
    if (s) songs.push(s);
  }
  return songs.slice(0, 20);
}
