import { Skeleton } from "@/components/ui/skeleton";
import { Music, Play } from "lucide-react";
import { motion } from "motion/react";
import type { Song } from "../backend";
import { SongCard } from "../components/SongCard/SongCard";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAllPlaylists,
  useAllSongs,
  useListeningHistory,
  useUserProfile,
} from "../hooks/useQueries";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";

const GENRES = [
  { label: "Pop", color: "bg-pink-600", query: "top pop hits 2024" },
  { label: "Hip-Hop", color: "bg-orange-600", query: "hip hop hits 2024" },
  { label: "Rock", color: "bg-red-700", query: "rock classics" },
  {
    label: "Electronic",
    color: "bg-blue-600",
    query: "electronic dance music",
  },
  { label: "R&B", color: "bg-purple-600", query: "r&b soul music 2024" },
  { label: "Jazz", color: "bg-yellow-700", query: "jazz classics" },
  {
    label: "Classical",
    color: "bg-teal-700",
    query: "classical music relaxing",
  },
  { label: "Country", color: "bg-amber-700", query: "country hits 2024" },
];

const MOODS = [
  {
    label: "Deep Focus",
    emoji: "🎯",
    query: "Lofi study music long play",
    gradient: "from-blue-600 to-indigo-800",
  },
  {
    label: "Gym Beast",
    emoji: "💪",
    query: "Aggressive Phonk music workout",
    gradient: "from-red-600 to-orange-700",
  },
  {
    label: "Midnight Chill",
    emoji: "🌙",
    query: "Midnight chill RnB slow",
    gradient: "from-purple-700 to-slate-800",
  },
  {
    label: "High Energy",
    emoji: "⚡",
    query: "High energy EDM workout",
    gradient: "from-yellow-500 to-pink-600",
  },
];

const SKEL_6 = ["s0", "s1", "s2", "s3", "s4", "s5"];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Home() {
  const { identity } = useInternetIdentity();
  const { data: profile } = useUserProfile();
  const { data: history = [], isLoading: historyLoading } =
    useListeningHistory();
  const { data: allSongs = [] } = useAllSongs();
  const { data: playlists = [] } = useAllPlaylists();
  const { navigate } = useNavigationStore();
  // suppress unused - playSong used only by SongCard via queue
  void usePlayerStore;
  const username =
    profile?.name || identity?.getPrincipal().toString().slice(0, 8) || "there";

  const recentSongIds = [...new Set(history.map((h) => h.songId))].slice(0, 6);
  const recentSongs: Song[] = recentSongIds
    .map((id) => allSongs.find((s) => s.videoId === id))
    .filter((s): s is Song => !!s);

  const triggerSearch = (query: string) => {
    navigate("search");
    sessionStorage.setItem("flute_search_query", query);
    window.dispatchEvent(new CustomEvent("flute-search", { detail: query }));
  };

  return (
    <div className="px-6 py-8 space-y-10">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-foreground">
          {getGreeting()}, {username}!
        </h1>
      </motion.div>

      {/* Mood Buttons */}
      <section>
        <h2 className="text-lg font-bold text-foreground mb-3">Mood</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {MOODS.map((mood, i) => (
            <motion.button
              key={mood.label}
              type="button"
              data-ocid={`mood.item.${i + 1}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => triggerSearch(mood.query)}
              className={`bg-gradient-to-br ${mood.gradient} flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold text-sm shadow-lg hover:opacity-90 hover:scale-105 transition-all`}
            >
              <span className="text-base">{mood.emoji}</span>
              {mood.label}
            </motion.button>
          ))}
        </div>
      </section>

      {/* Quick access: playlists */}
      {playlists.length > 0 && (
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {playlists.slice(0, 6).map((pl, i) => (
              <motion.button
                key={pl.id.toString()}
                type="button"
                data-ocid={`home.playlist.item.${i + 1}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate("playlist", pl.id)}
                className="flex items-center gap-3 bg-accent hover:bg-accent/80 rounded-lg overflow-hidden transition-colors group h-14"
              >
                <div className="w-14 h-14 bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Music className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground truncate pr-2">
                  {pl.name}
                </span>
                <div className="ml-auto mr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Play className="w-4 h-4 text-primary-foreground fill-current ml-0.5" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Recently Played */}
      {(recentSongs.length > 0 || historyLoading) && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">
            Recently Played
          </h2>
          {historyLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {SKEL_6.map((k) => (
                <div key={k} className="space-y-3">
                  <Skeleton className="aspect-square rounded-lg bg-accent" />
                  <Skeleton className="h-3 rounded bg-accent" />
                  <Skeleton className="h-3 w-2/3 rounded bg-accent" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {recentSongs.map((song, i) => (
                <SongCard
                  key={song.videoId}
                  song={song}
                  queue={recentSongs}
                  index={i}
                  variant="grid"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Browse by Genre */}
      <section>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Browse Categories
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {GENRES.map((genre, i) => (
            <motion.button
              key={genre.label}
              type="button"
              data-ocid={`genre.item.${i + 1}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => triggerSearch(genre.query)}
              className={`${genre.color} rounded-xl p-4 h-24 flex items-end hover:opacity-90 transition-opacity relative overflow-hidden`}
            >
              <span className="text-lg font-bold text-white">
                {genre.label}
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* All cached songs */}
      {allSongs.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4">Your Music</h2>
          <div className="space-y-1">
            {allSongs.slice(0, 10).map((song, i) => (
              <SongCard
                key={song.videoId}
                song={song}
                queue={allSongs}
                index={i}
                variant="list"
              />
            ))}
          </div>
          {allSongs.length > 10 && (
            <button
              type="button"
              onClick={() => navigate("library")}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all {allSongs.length} songs →
            </button>
          )}
        </section>
      )}

      {/* Empty state */}
      {allSongs.length === 0 && recentSongs.length === 0 && !historyLoading && (
        <motion.div
          data-ocid="home.empty_state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Start discovering music
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            Search for any song, artist, or genre to start listening
          </p>
          <button
            type="button"
            data-ocid="home.primary_button"
            onClick={() => navigate("search")}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Find Music
          </button>
        </motion.div>
      )}

      <footer className="text-center pt-8 pb-2">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
