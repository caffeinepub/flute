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
];

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const getVideoId = (url: string): string => {
  if (!url) return "";
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : "";
};

interface PipedRelatedStream {
  url: string;
  title: string;
  uploaderName: string;
  thumbnail: string;
  duration: number;
}

async function tryFetch(instance: string, videoId: string): Promise<Song[]> {
  const res = await fetch(`${instance}/streams/${videoId}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error("not ok");
  const data = await res.json();
  const related: PipedRelatedStream[] = data.relatedStreams || [];
  const songs: Song[] = related
    .filter((s) => s.duration >= 60)
    .map((s) => ({
      videoId: getVideoId(s.url),
      title: s.title,
      channel: s.uploaderName,
      thumbnail: s.thumbnail,
      duration: formatDuration(s.duration),
    }))
    .filter((s) => s.videoId);

  if (songs.length === 0) throw new Error("empty");

  songs.sort(
    (a, b) => scoreTrack(b.title, b.channel) - scoreTrack(a.title, a.channel),
  );

  return songs.slice(0, 15);
}

export async function fetchRelatedSongs(videoId: string): Promise<Song[]> {
  try {
    return await Promise.any(
      PIPED_INSTANCES.map((instance) => tryFetch(instance, videoId)),
    );
  } catch {
    return [];
  }
}
