import { Button } from "@/components/ui/button";
import { Heart, Play } from "lucide-react";
import { motion } from "motion/react";
import { SongCard } from "../components/SongCard/SongCard";
import { useLocalLikedSongs } from "../hooks/useLocalQueries";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";

export function LikedSongs() {
  const { likedSongs: songs } = useLocalLikedSongs();
  const { playSong } = usePlayerStore();
  const { navigate } = useNavigationStore();

  const handlePlayAll = () => {
    if (songs.length > 0) playSong(songs[0], songs);
  };

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-6 mb-8">
        <div className="w-40 h-40 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-card flex-shrink-0">
          <Heart className="w-16 h-16 text-white fill-white" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Playlist
          </p>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Liked Songs
          </h1>
          <p className="text-sm text-muted-foreground">{songs.length} songs</p>
          {songs.length > 0 && (
            <Button
              data-ocid="liked.primary_button"
              onClick={handlePlayAll}
              className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
            >
              <Play className="w-4 h-4 mr-2 fill-current" /> Play All
            </Button>
          )}
        </div>
      </div>

      {songs.length === 0 ? (
        <motion.div
          data-ocid="liked.empty_state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Songs you like will appear here
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            Save songs by tapping the heart icon
          </p>
          <Button
            data-ocid="liked.secondary_button"
            onClick={() => navigate("search")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
          >
            Find songs to like
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-1">
          {songs.map((song, i) => (
            <SongCard
              key={song.videoId}
              song={song}
              queue={songs}
              index={i}
              variant="list"
            />
          ))}
        </div>
      )}
    </div>
  );
}
