import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search as SearchIcon } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { Song } from "../backend";
import { SongCard } from "../components/SongCard/SongCard";
import { useNavigationStore } from "../store/navigationStore";

const GENRE_SHORTCUTS = [
  "Top hits 2024",
  "Chill vibes",
  "Workout music",
  "Late night jazz",
  "Pop classics",
  "Hip hop bangers",
  "Indie rock",
  "Electronic EDM",
];

function parseISO8601Duration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const h = Number.parseInt(match[1] || "0");
  const m = Number.parseInt(match[2] || "0");
  const s = Number.parseInt(match[3] || "0");
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function searchYouTube(query: string, apiKey: string): Promise<Song[]> {
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=20`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error(`YouTube API error: ${searchRes.status}`);
  const searchData = await searchRes.json();

  if (!searchData.items || searchData.items.length === 0) return [];

  const videoIds = searchData.items
    .map((item: { id: { videoId?: string } }) => item.id.videoId)
    .filter(Boolean)
    .join(",");

  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();

  const durationMap: Record<string, string> = {};
  if (detailsData.items) {
    for (const item of detailsData.items as {
      id: string;
      contentDetails: { duration: string };
    }[]) {
      durationMap[item.id] = parseISO8601Duration(item.contentDetails.duration);
    }
  }

  return searchData.items
    .filter((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .map(
      (item: {
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { high?: { url: string }; default?: { url: string } };
        };
      }) =>
        ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          thumbnail:
            item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.default?.url ||
            "",
          duration: durationMap[item.id.videoId] || "0:00",
        }) satisfies Song,
    );
}

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { navigate } = useNavigationStore();

  const apiKey = localStorage.getItem("yt_api_key") || "";

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      if (!apiKey) {
        setError("Please set your YouTube API key in Settings first.");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const songs = await searchYouTube(q, apiKey);
        setResults(songs);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [apiKey],
  );

  useEffect(() => {
    const q = sessionStorage.getItem("flute_search_query");
    if (q) {
      setQuery(q);
      sessionStorage.removeItem("flute_search_query");
      doSearch(q);
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setQuery(detail);
      doSearch(detail);
    };
    window.addEventListener("flute-search", handler);
    return () => window.removeEventListener("flute-search", handler);
  }, [doSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch(query);
  };

  return (
    <div className="px-6 py-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-foreground mb-4">Search</h1>
        <div className="relative max-w-xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            data-ocid="search.search_input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, artists, albums..."
            className="pl-12 h-12 bg-accent border-border text-foreground placeholder:text-muted-foreground text-base rounded-full"
          />
        </div>

        {!apiKey && (
          <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>
              YouTube API key not set.{" "}
              <button
                type="button"
                onClick={() => navigate("settings")}
                className="underline hover:text-yellow-200"
              >
                Add it in Settings
              </button>
            </span>
          </div>
        )}
      </motion.div>

      {!query && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Quick Picks
          </h2>
          <div className="flex flex-wrap gap-2">
            {GENRE_SHORTCUTS.map((g) => (
              <button
                key={g}
                type="button"
                data-ocid="search.tab"
                onClick={() => {
                  setQuery(g);
                  doSearch(g);
                }}
                className="px-4 py-2 rounded-full bg-accent hover:bg-primary hover:text-primary-foreground text-sm font-medium text-foreground transition-colors border border-border"
              >
                {g}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div
          data-ocid="search.error_state"
          className="flex items-center gap-2 text-destructive"
        >
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {loading && (
        <div
          data-ocid="search.loading_state"
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"].map(
            (k) => (
              <div key={k} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg bg-accent" />
                <Skeleton className="h-3 rounded bg-accent" />
                <Skeleton className="h-3 w-2/3 rounded bg-accent" />
              </div>
            ),
          )}
        </div>
      )}

      {!loading && results.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Results for &ldquo;{query}&rdquo;
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {results.map((song, i) => (
              <SongCard
                key={song.videoId}
                song={song}
                queue={results}
                index={i}
                variant="grid"
              />
            ))}
          </div>
        </section>
      )}

      {!loading && query && results.length === 0 && !error && (
        <div data-ocid="search.empty_state" className="text-center py-16">
          <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            No results found for &ldquo;{query}&rdquo;
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Try a different search term
          </p>
        </div>
      )}
    </div>
  );
}
