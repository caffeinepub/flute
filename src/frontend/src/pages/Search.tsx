import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Search as SearchIcon } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import type { Song } from "../backend";
import { SongCard } from "../components/SongCard/SongCard";
import { searchVideos } from "../lib/invidious";
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

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { navigate } = useNavigationStore();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const songs = await searchVideos(q);
      setResults(songs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

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

  // keep navigate in scope to suppress unused warning
  void navigate;

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
          <p className="text-muted-foreground">
            No results for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
