import type { Song } from "../backend";

const INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.privacydev.net",
  "https://yt.artemislena.eu",
];

export interface InvidiousVideo {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: number;
  videoThumbnails: Array<{ quality: string; url: string }>;
}

async function invidiousFetch(path: string): Promise<unknown> {
  for (const instance of INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return res.json();
    } catch {
      // try next
    }
  }
  throw new Error("All Invidious instances failed");
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const BLOCKED = ["live", "reaction", "cover", "vlog"];
function isMusic(title: string, secs: number): boolean {
  if (secs < 120) return false;
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
    thumbnail: thumb?.url || "",
    duration: formatDuration(v.lengthSeconds),
  };
}

export async function searchVideos(query: string): Promise<Song[]> {
  const q = encodeURIComponent(`${query} official audio`);
  const data = (await invidiousFetch(
    `/api/v1/search?q=${q}&type=video&maxResults=20`,
  )) as InvidiousVideo[];
  return data
    .filter((v): v is InvidiousVideo => !!v.videoId)
    .map(toSong)
    .filter((s): s is Song => s !== null)
    .slice(0, 20);
}

export async function fetchTrending(genres: string[] = []): Promise<Song[]> {
  const [trending, ...genreResults] = await Promise.allSettled([
    invidiousFetch("/api/v1/trending?type=music&region=US") as Promise<
      InvidiousVideo[]
    >,
    ...genres
      .slice(0, 3)
      .map(
        (g) =>
          invidiousFetch(
            `/api/v1/search?q=${encodeURIComponent(`${g} official audio`)}&type=video&maxResults=5`,
          ) as Promise<InvidiousVideo[]>,
      ),
  ]);

  const all: InvidiousVideo[] = [];
  if (trending.status === "fulfilled") all.push(...trending.value);
  for (const r of genreResults) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  const seen = new Set<string>();
  const songs: Song[] = [];
  for (const v of all) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    const s = toSong(v);
    if (s) songs.push(s);
  }
  return songs.slice(0, 20);
}
