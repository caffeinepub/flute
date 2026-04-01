import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  Heart,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useLikeSong,
  useLikedSongs,
  useUnlikeSong,
} from "../../hooks/useQueries";
import { useNavigationStore } from "../../store/navigationStore";
import { usePlayerStore } from "../../store/playerStore";

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    togglePlay,
    next,
    prev,
    seekTo,
    setVolume,
    toggleShuffle,
    setRepeat,
  } = usePlayerStore();
  const { navigate } = useNavigationStore();
  const { data: likedSongs = [] } = useLikedSongs();
  const likeSong = useLikeSong();
  const unlikeSong = useUnlikeSong();

  const isLiked = currentSong
    ? likedSongs.some((s) => s.videoId === currentSong.videoId)
    : false;

  const handleLike = () => {
    if (!currentSong) return;
    if (isLiked) {
      unlikeSong.mutate(currentSong.videoId);
    } else {
      likeSong.mutate(currentSong.videoId);
    }
  };

  const cycleRepeat = () => {
    if (repeat === "none") setRepeat("all");
    else if (repeat === "all") setRepeat("one");
    else setRepeat("none");
  };

  if (!currentSong) {
    return (
      <div
        data-ocid="player.panel"
        className="fixed bottom-0 left-0 right-0 h-20 bg-[oklch(0.174_0_0)] border-t border-[oklch(0.24_0_0)] z-50 flex items-center justify-center"
      >
        <p className="text-muted-foreground text-sm">
          No song playing &mdash; search for music to get started
        </p>
      </div>
    );
  }

  return (
    <div
      data-ocid="player.panel"
      className="fixed bottom-0 left-0 right-0 h-[88px] bg-[oklch(0.174_0_0)] border-t border-[oklch(0.24_0_0)] z-50 flex items-center px-4 gap-4"
    >
      {/* Left: song info */}
      <div className="flex items-center gap-3 w-64 flex-shrink-0 min-w-0">
        <button
          type="button"
          onClick={() => navigate("nowplaying")}
          className="flex-shrink-0"
        >
          <img
            src={currentSong.thumbnail}
            alt={currentSong.title}
            className="w-14 h-14 rounded object-cover shadow-card hover:scale-105 transition-transform"
          />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate("nowplaying")}
            className="text-sm font-semibold text-foreground hover:underline truncate block max-w-full"
          >
            {currentSong.title}
          </button>
          <p className="text-xs text-muted-foreground truncate">
            {currentSong.channel}
          </p>
        </div>
        <button
          type="button"
          data-ocid="player.toggle"
          onClick={handleLike}
          className={cn(
            "p-1 transition-colors flex-shrink-0",
            isLiked
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
        </button>
      </div>

      {/* Center: controls */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-2xl">
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-ocid="player.toggle"
            onClick={toggleShuffle}
            className={cn(
              "p-1 transition-colors",
              shuffle
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-ocid="player.secondary_button"
            onClick={prev}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          <button
            type="button"
            data-ocid="player.primary_button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:scale-105 transition-transform text-primary-foreground"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            data-ocid="player.secondary_button"
            onClick={next}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
          <button
            type="button"
            data-ocid="player.toggle"
            onClick={cycleRepeat}
            className={cn(
              "p-1 transition-colors",
              repeat !== "none"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {repeat === "one" ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Seek bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-muted-foreground w-8 text-right">
            {formatTime(progress)}
          </span>
          <Slider
            data-ocid="player.editor"
            value={[progress]}
            onValueChange={([v]) => seekTo(v)}
            min={0}
            max={duration || 100}
            step={1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: volume + queue */}
      <div className="flex items-center gap-3 w-48 justify-end flex-shrink-0">
        <button
          type="button"
          data-ocid="player.secondary_button"
          onClick={() => navigate("nowplaying")}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          title="Now Playing"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          data-ocid="player.secondary_button"
          onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors flex-shrink-0"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
        <Slider
          data-ocid="player.editor"
          value={[Math.round(volume * 100)]}
          onValueChange={([v]) => setVolume(v / 100)}
          min={0}
          max={100}
          step={1}
          className="w-24"
        />
        <button
          type="button"
          data-ocid="queue.secondary_button"
          onClick={() => navigate("nowplaying")}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          title="Queue"
        >
          <ListMusic className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
