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

function pipedToInvidious(item: PipedItem): InvidiousVideo | null {
  const match = item.url?.match(/[?&]v=([^&]+)/);
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

async function pipedFetch(path: string): Promise<unknown> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return res.json();
    } catch {
      // try next
    }
  }
  throw new Error("All Piped instances failed");
}

// For search, try instances until we get non-empty results
async function pipedSearchFetch(path: string): Promise<{ items: PipedItem[] }> {
  let lastError: Error | null = null;
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { items: PipedItem[] };
      const filtered = (data?.items ?? []).filter(
        (item) => item.type !== "channel" && item.type !== "playlist",
      );
      if (filtered.length > 0) return data;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  if (lastError) throw lastError;
  return { items: [] };
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
