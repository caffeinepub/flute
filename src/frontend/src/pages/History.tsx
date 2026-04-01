import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { motion } from "motion/react";
import type { Song } from "../backend";
import { SongCard } from "../components/SongCard/SongCard";
import { useAllSongs, useListeningHistory } from "../hooks/useQueries";

const SKEL_10 = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"];

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function History() {
  const { data: history = [], isLoading: historyLoading } =
    useListeningHistory();
  const { data: allSongs = [], isLoading: songsLoading } = useAllSongs();

  const isLoading = historyLoading || songsLoading;

  const historySongs: { song: Song; timestamp: bigint }[] = history
    .map((entry) => {
      const song = allSongs.find((s) => s.videoId === entry.songId);
      return song ? { song, timestamp: entry.timestamp } : null;
    })
    .filter((x): x is { song: Song; timestamp: bigint } => !!x);

  const songsForQueue = historySongs.map((x) => x.song);

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">
          Listening History
        </h1>
      </div>

      {isLoading ? (
        <div data-ocid="history.loading_state" className="space-y-2">
          {SKEL_10.map((k) => (
            <Skeleton key={k} className="h-14 rounded-lg bg-accent" />
          ))}
        </div>
      ) : historySongs.length === 0 ? (
        <motion.div
          data-ocid="history.empty_state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No listening history yet
          </h3>
          <p className="text-muted-foreground text-sm">
            Songs you play will appear here
          </p>
        </motion.div>
      ) : (
        <div className="space-y-1">
          {historySongs.map(({ song, timestamp }, i) => (
            <motion.div
              key={`${song.videoId}-${timestamp.toString()}`}
              data-ocid={`history.item.${i + 1}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <SongCard
                  song={song}
                  queue={songsForQueue}
                  index={i}
                  variant="list"
                />
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 w-28 text-right">
                {formatTimestamp(timestamp)}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
