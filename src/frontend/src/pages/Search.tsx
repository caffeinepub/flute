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

const BLOCKED_TITLE_KEYWORDS = ["live", "reaction", "cover", "vlog"];

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
  const filteredQuery = `${query} official audio`;
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(filteredQuery)}&key=${apiKey}&maxResults=20`;
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
    .filter(
      (item: { id?: { videoId?: string }; snippet?: { title?: string } }) => {
        if (!item.id?.videoId) return false;
        const title = item.snippet?.title?.toLowerCase() || "";
        return !BLOCKED_TITLE_KEYWORDS.some((kw) => title.includes(kw));
      },
    )
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
      const detail = (e as CustomEvent<string>).detail;
      setQuery(detail);
      doSearch(detail);
    };

    window.addEventListener("flute-search", handler);
    return () => window.removeEventListener("flute-search", handler);
  }, [doSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") doSearch(query);
  };

  return (
    <div className="px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-4">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-ocid="search.input"
            placeholder="Songs, artists, genres..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 bg-accent border-border text-foreground h-12 rounded-full"
          />
        </div>
      </motion.div>

      {/* Genre shortcuts */}
      {!query && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Browse
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
                className="px-4 py-2 rounded-full bg-accent text-foreground text-sm hover:bg-accent/70 transition-colors"
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          data-ocid="search.error_state"
          className="flex items-center gap-2 p-4 rounded-lg bg-destructive/20 text-destructive mb-4"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          {error.includes("API key") && (
            <button
              type="button"
              className="ml-auto text-xs underline"
              onClick={() => navigate("settings")}
            >
              Settings
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div data-ocid="search.loading_state" className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skel-${
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                i
              }`}
              className="flex items-center gap-3 p-3"
            >
              <Skeleton className="w-12 h-12 rounded bg-accent flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 rounded bg-accent" />
                <Skeleton className="h-3 w-2/3 rounded bg-accent" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-1"
        >
          {results.map((song, i) => (
            <SongCard
              key={song.videoId}
              song={song}
              queue={results}
              index={i}
              variant="list"
            />
          ))}
        </motion.div>
      )}

      {/* Empty */}
      {!loading && !error && results.length === 0 && query && (
        <div data-ocid="search.empty_state" className="text-center py-16">
          <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No results for "{query}"</p>
        </div>
      )}
    </div>
  );
}
