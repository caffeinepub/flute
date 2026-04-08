import { Clock } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { SongCard } from "../components/SongCard/SongCard";
import type { Song } from "../types/song";
import { getLocalHistory } from "../utils/localHistory";

interface GroupedHistory {
  label: string;
  entries: { song: Song; timestamp: number }[];
}

function getDateLabel(ts: number): string {
  const now = new Date();
  const date = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const entryDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (entryDay.getTime() === today.getTime()) return "Today";
  if (entryDay.getTime() === yesterday.getTime()) return "Yesterday";
  if (entryDay.getTime() >= weekAgo.getTime()) return "This Week";
  return "Earlier";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function History() {
  const [groups, setGroups] = useState<GroupedHistory[]>([]);

  useEffect(() => {
    const entries = getLocalHistory();
    const map = new Map<string, { song: Song; timestamp: number }[]>();
    for (const entry of entries) {
      const label = getDateLabel(entry.timestamp);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(entry);
    }

    const order = ["Today", "Yesterday", "This Week", "Earlier"];
    const result: GroupedHistory[] = [];
    for (const label of order) {
      if (map.has(label)) {
        result.push({ label, entries: map.get(label)! });
      }
    }
    setGroups(result);
  }, []);

  const allSongs = groups.flatMap((g) => g.entries.map((e) => e.song));

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">
          Listening History
        </h1>
      </div>

      {groups.length === 0 ? (
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
        <div className="space-y-6">
          {groups.map((group) => (
            <motion.div
              key={group.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h2>
              <div className="space-y-1">
                {group.entries.map(({ song, timestamp }, i) => (
                  <motion.div
                    key={`${song.videoId}-${timestamp}`}
                    data-ocid={`history.item.${i + 1}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <SongCard
                        song={song}
                        queue={allSongs}
                        index={i}
                        variant="list"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 w-14 text-right">
                      {formatTime(timestamp)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
