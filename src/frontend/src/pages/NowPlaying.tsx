import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  Music2,
  Pause,
  Play,
  PlayCircle,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useCacheLyrics,
  useFetchLyrics,
  useLikeSong,
  useLikedSongs,
  useUnlikeSong,
} from "../hooks/useQueries";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";
import type { Song } from "../types/song";
import {
  classifyMood,
  reinforceNegative,
  reinforcePositive,
} from "../utils/moodPrefs";
import {
  fetchRelatedSongs,
  invalidateRelatedCache,
} from "../utils/pipedRecommendations";

const SKEL_5 = ["rs0", "rs1", "rs2", "rs3", "rs4"];

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlaying() {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    queue,
    queueIndex,
    togglePlay,
    next,
    prev,
    seekTo,
    setVolume,
    toggleShuffle,
    setRepeat,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    playNext,
    currentSource,
    setCurrentSource,
    playSongFromSimilar,
    brokenSongs,
    fixSong,
    addToQueue,
    addToSimilar,
  } = usePlayerStore();
  const { goBack } = useNavigationStore();
  const { data: likedSongs = [] } = useLikedSongs();
  const likeSong = useLikeSong();
  const unlikeSong = useUnlikeSong();
  const cacheLyrics = useCacheLyrics();

  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState(false);
  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "related">(
    "lyrics",
  );

  // Track which songs are currently being fixed (for loading spinner)
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set());

  const isLiked = currentSong
    ? likedSongs.some((s) => s.videoId === currentSong.videoId)
    : false;

  const { data: lyricsData = "", isLoading: lyricsLoading } = useFetchLyrics(
    currentSong?.channel || "",
    currentSong?.title || "",
    !!currentSong && !currentSong.lyrics,
  );

  const lyrics = currentSong?.lyrics || lyricsData;

  const cacheLyricsRef = useRef(cacheLyrics.mutate);
  cacheLyricsRef.current = cacheLyrics.mutate;

  useEffect(() => {
    if (!lyricsData || !currentSong || currentSong.lyrics) return;
    cacheLyricsRef.current({ songId: currentSong.videoId, lyrics: lyricsData });
  }, [lyricsData, currentSong]);

  const currentVideoId = currentSong?.videoId;

  const loadRelated = useCallback((videoId: string, invalidate = false) => {
    if (invalidate) invalidateRelatedCache(videoId);
    setRelatedLoading(true);
    setRelatedError(false);
    const song = usePlayerStore.getState().currentSong;
    fetchRelatedSongs(videoId, song?.title, song?.channel)
      .then((songs) => {
        setRelatedSongs(songs);
        setRelatedLoading(false);
        if (songs.length === 0) {
          setRelatedError(true);
        }
      })
      .catch(() => {
        setRelatedLoading(false);
        setRelatedError(true);
      });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed only on videoId
  useEffect(() => {
    if (!currentVideoId) return;
    loadRelated(currentVideoId);
  }, [currentVideoId]);

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

  const handleListened = (song: Song) => {
    reinforcePositive(classifyMood(song.title), song.channel);
    toast.success("Got it! We'll play more like this 👍");
  };

  const handleNotInterested = (song: Song, index: number) => {
    reinforceNegative(classifyMood(song.title), song.channel);
    setRelatedSongs((prev) => prev.filter((_, i) => i !== index));
    toast("Removed from suggestions", { icon: "👎" });
  };

  const handleTabClick = (tab: "lyrics" | "queue" | "related") => {
    setActiveTab(tab);
    if (tab === "related") {
      setCurrentSource("similar");
    } else if (tab === "queue") {
      setCurrentSource("queue");
    }
  };

  const handleFixSong = async (videoId: string) => {
    setFixingIds((prev) => new Set(prev).add(videoId));
    try {
      await fixSong(videoId);
      toast.success("Song fixed! Retrying playback.");
    } catch {
      toast.error("Couldn't fix this song. Try a different one.");
    } finally {
      setFixingIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  const handleRelatedSongClick = (song: Song) => {
    // ISSUE 2 FIX: clicking a related song always sets source to similar and plays from that list
    setCurrentSource("similar");
    playSongFromSimilar(song, relatedSongs);
  };

  // ISSUE 2 FIX: "Add to Queue" routes based on ACTIVE TAB, not currentSource
  // (currentSource can lag briefly if user taps add without first switching tabs)
  const handleAddToCurrentTab = (song: Song) => {
    if (activeTab === "related") {
      // Add to similarQueue and also to relatedSongs local display list
      addToSimilar(song);
      setRelatedSongs((prev) => {
        if (prev.find((s) => s.videoId === song.videoId)) return prev;
        return [...prev, song];
      });
      toast.success("Added to Similar Songs");
    } else {
      addToQueue(song);
      toast.success("Added to queue");
    }
  };

  if (!currentSong) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Music2 className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground">Nothing playing right now</p>
        <button
          type="button"
          onClick={goBack}
          className="text-primary hover:text-primary/80 text-sm font-medium"
        >
          Go back
        </button>
      </div>
    );
  }

  const currentSongBroken = brokenSongs.includes(currentSong.videoId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col lg:flex-row min-h-screen px-6 py-8 gap-8 relative"
    >
      <button
        type="button"
        data-ocid="nowplaying.secondary_button"
        onClick={goBack}
        className="absolute top-6 left-4 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        <ChevronDown className="w-5 h-5" />
      </button>

      {/* Left: Player */}
      <div className="flex flex-col items-center gap-6 lg:w-80 flex-shrink-0">
        <div className="relative">
          <motion.img
            key={currentSong.videoId}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={currentSong.thumbnail}
            alt={currentSong.title}
            className="w-64 h-64 lg:w-72 lg:h-72 rounded-2xl object-cover shadow-card"
          />
          {/* Broken song banner on album art */}
          {currentSongBroken && (
            <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-amber-500/90 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-900 shrink-0" />
                <span className="text-xs font-semibold text-amber-900">
                  Playback issue
                </span>
              </div>
              <button
                type="button"
                data-ocid="nowplaying.fix_button"
                onClick={() => handleFixSong(currentSong.videoId)}
                disabled={fixingIds.has(currentSong.videoId)}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-900 text-amber-100 text-xs font-semibold hover:bg-amber-800 disabled:opacity-60 transition-colors"
              >
                {fixingIds.has(currentSong.videoId) ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wrench className="w-3 h-3" />
                )}
                Fix
              </button>
            </div>
          )}
        </div>

        <div className="text-center w-full">
          <h2 className="text-xl font-bold text-foreground truncate">
            {currentSong.title}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {currentSong.channel}
          </p>
        </div>

        <button
          type="button"
          data-ocid="nowplaying.toggle"
          onClick={handleLike}
          className={cn(
            "self-end -mt-4",
            isLiked
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className={cn("w-5 h-5", isLiked && "fill-current")} />
        </button>

        <div className="w-full space-y-1">
          <Slider
            data-ocid="nowplaying.editor"
            value={[progress]}
            onValueChange={([v]) => seekTo(v)}
            min={0}
            max={duration || 100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button
            type="button"
            data-ocid="nowplaying.toggle"
            onClick={toggleShuffle}
            className={cn(
              shuffle
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Shuffle className="w-5 h-5" />
          </button>
          <button
            type="button"
            data-ocid="nowplaying.secondary_button"
            onClick={prev}
            className="text-muted-foreground hover:text-foreground"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>
          <button
            type="button"
            data-ocid="nowplaying.primary_button"
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center hover:scale-105 transition-transform text-primary-foreground shadow-card"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            data-ocid="nowplaying.secondary_button"
            onClick={next}
            className="text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>
          <button
            type="button"
            data-ocid="nowplaying.toggle"
            onClick={cycleRepeat}
            className={cn(
              repeat !== "none"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {repeat === "one" ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
            className="text-muted-foreground hover:text-foreground"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <Slider
            value={[Math.round(volume * 100)]}
            onValueChange={([v]) => setVolume(v / 100)}
            min={0}
            max={100}
            step={1}
            className="flex-1"
          />
        </div>
      </div>

      {/* Right: Lyrics / Queue / Similar Songs */}
      <div className="flex-1 min-w-0">
        {/* Source indicator badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
              currentSource === "similar"
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-accent text-muted-foreground border-border",
            )}
          >
            {currentSource === "similar" ? "▶ Similar" : "▶ Queue"}
          </span>
        </div>

        <div className="flex gap-1 mb-6 bg-accent rounded-xl p-1 w-fit">
          {(["lyrics", "queue", "related"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              data-ocid={`nowplaying.${tab}.tab`}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize",
                activeTab === tab
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "related"
                ? "Similar Songs"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Lyrics */}
        {activeTab === "lyrics" && (
          <div data-ocid="nowplaying.panel">
            {lyricsLoading ? (
              <div data-ocid="nowplaying.loading_state" className="space-y-3">
                <Skeleton className="h-4 w-full bg-accent" />
                <Skeleton className="h-4 w-5/6 bg-accent" />
                <Skeleton className="h-4 w-4/5 bg-accent" />
                <Skeleton className="h-4 w-full bg-accent" />
              </div>
            ) : lyrics ? (
              <ScrollArea className="h-[50vh]">
                <pre className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {lyrics}
                </pre>
              </ScrollArea>
            ) : (
              <div
                data-ocid="nowplaying.empty_state"
                className="text-center py-12"
              >
                <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No lyrics available</p>
              </div>
            )}
          </div>
        )}

        {/* Queue */}
        {activeTab === "queue" && (
          <div data-ocid="nowplaying.panel">
            {/* Queue header with shuffle + clear */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">
                Up Next
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-ocid="queue.toggle"
                  onClick={toggleShuffle}
                  title="Shuffle"
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                    shuffle
                      ? "bg-primary/20 text-primary"
                      : "bg-accent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-ocid="queue.delete_button"
                  onClick={() => {
                    clearQueue();
                    toast.success("Queue cleared");
                  }}
                  title="Clear queue"
                  className="w-8 h-8 rounded-full bg-accent hover:bg-red-500/20 hover:text-red-400 text-muted-foreground flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {queue.length === 0 ? (
              <div
                data-ocid="nowplaying.empty_state"
                className="text-center py-12"
              >
                <ListMusic className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Queue is empty</p>
              </div>
            ) : (
              <ScrollArea className="h-[55vh]">
                <div className="space-y-2 pr-2">
                  {queue.map((song, i) => {
                    const isCurrent =
                      song.videoId === currentSong.videoId && i === queueIndex;
                    const isBroken = brokenSongs.includes(song.videoId);
                    const isFixing = fixingIds.has(song.videoId);
                    return (
                      <div
                        key={`${song.videoId}-${i}`}
                        data-ocid={`queue.item.${i + 1}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                          isCurrent
                            ? "bg-primary/10 border-l-2 border-primary"
                            : "hover:bg-accent",
                          isBroken && "border border-amber-500/30",
                        )}
                      >
                        {/* Modern drag handle + reorder */}
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                          <GripVertical className="w-4 h-4 text-muted-foreground/40 mb-0.5" />
                          <button
                            type="button"
                            data-ocid={`queue.edit_button.${i + 1}`}
                            disabled={i === 0}
                            onClick={() => reorderQueue(i, i - 1)}
                            className="w-6 h-6 rounded-full bg-accent hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-ocid={`queue.edit_button.${i + 1}`}
                            disabled={i === queue.length - 1}
                            onClick={() => reorderQueue(i, i + 1)}
                            className="w-6 h-6 rounded-full bg-accent hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Thumbnail + info */}
                        <button
                          type="button"
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          onClick={() =>
                            usePlayerStore.getState().playSong(song, queue)
                          }
                        >
                          <img
                            src={song.thumbnail}
                            alt={song.title}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium truncate",
                                isCurrent ? "text-primary" : "text-foreground",
                                isBroken && "text-amber-400",
                              )}
                            >
                              {song.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {song.channel}
                            </p>
                          </div>
                        </button>

                        {/* Fix button for broken songs + Play Now + Feedback + remove */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isBroken && (
                            <button
                              type="button"
                              data-ocid={`queue.fix_button.${i + 1}`}
                              title="Fix broken song"
                              disabled={isFixing}
                              onClick={() => handleFixSong(song.videoId)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 text-xs font-semibold border border-amber-500/30 disabled:opacity-60 transition-colors"
                            >
                              {isFixing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Wrench className="w-3 h-3" />
                              )}
                              Fix
                            </button>
                          )}
                          <button
                            type="button"
                            data-ocid={`queue.primary_button.${i + 1}`}
                            title="Play now"
                            onClick={() => playNext(song)}
                            className="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary/25 flex items-center justify-center transition-colors"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-ocid={`queue.toggle.${i + 1}`}
                            title="Listened — play more like this"
                            onClick={() => handleListened(song)}
                            className="w-8 h-8 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/25 hover:text-green-300 flex items-center justify-center transition-colors"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-ocid={`queue.delete_button.${i + 1}`}
                            title="Not interested"
                            onClick={() => handleNotInterested(song, i)}
                            className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/25 hover:text-red-300 flex items-center justify-center transition-colors"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-ocid={`queue.close_button.${i + 1}`}
                            onClick={() => removeFromQueue(i)}
                            className="w-8 h-8 rounded-full bg-accent hover:bg-red-500/20 hover:text-red-400 text-muted-foreground flex items-center justify-center transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Similar Songs */}
        {activeTab === "related" && (
          <div data-ocid="nowplaying.panel">
            {relatedLoading ? (
              <div data-ocid="nowplaying.loading_state" className="space-y-3">
                {SKEL_5.map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded bg-accent flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-full bg-accent" />
                      <Skeleton className="h-3 w-2/3 bg-accent" />
                    </div>
                  </div>
                ))}
              </div>
            ) : relatedSongs.length === 0 ? (
              <div
                data-ocid="nowplaying.empty_state"
                className="text-center py-12 space-y-4"
              >
                <Music2 className="w-12 h-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-sm">
                  {relatedError
                    ? "Couldn't load similar songs"
                    : "No similar songs found"}
                </p>
                {currentVideoId && (
                  <button
                    type="button"
                    data-ocid="related.secondary_button"
                    onClick={() => {
                      if (!currentVideoId) return;
                      loadRelated(currentVideoId, true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-primary/20 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[50vh]">
                <div className="space-y-1">
                  {relatedSongs.map((song, i) => {
                    const isBroken = brokenSongs.includes(song.videoId);
                    const isFixing = fixingIds.has(song.videoId);
                    return (
                      <div
                        key={song.videoId}
                        data-ocid={`related.item.${i + 1}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors group",
                          isBroken && "border border-amber-500/20",
                        )}
                      >
                        {/* Thumbnail — click to play from similar source */}
                        <button
                          type="button"
                          className="relative flex-shrink-0"
                          onClick={() => handleRelatedSongClick(song)}
                        >
                          <img
                            src={song.thumbnail}
                            alt={song.title}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        </button>

                        {/* Title + channel — click to play from similar source */}
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() => handleRelatedSongClick(song)}
                        >
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              isBroken ? "text-amber-400" : "text-foreground",
                            )}
                          >
                            {song.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.channel}
                          </p>
                        </button>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Fix button for broken similar songs */}
                          {isBroken && (
                            <button
                              type="button"
                              data-ocid={`related.fix_button.${i + 1}`}
                              title="Fix broken song"
                              disabled={isFixing}
                              onClick={() => handleFixSong(song.videoId)}
                              className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 text-xs font-semibold border border-amber-500/30 disabled:opacity-60 transition-colors"
                            >
                              {isFixing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Wrench className="w-3 h-3" />
                              )}
                            </button>
                          )}
                          {/* Add to current tab */}
                          <button
                            type="button"
                            data-ocid={`related.add_button.${i + 1}`}
                            title={
                              activeTab === "related"
                                ? "Add to Similar Songs"
                                : "Add to Queue"
                            }
                            onClick={() => handleAddToCurrentTab(song)}
                            className="w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary/25 flex items-center justify-center transition-colors"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-ocid={`related.toggle.${i + 1}`}
                            title="More like this"
                            onClick={() => handleListened(song)}
                            className="w-7 h-7 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/25 hover:text-green-300 flex items-center justify-center transition-colors"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            data-ocid={`related.delete_button.${i + 1}`}
                            title="Not interested"
                            onClick={() => handleNotInterested(song, i)}
                            className="w-7 h-7 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/25 hover:text-red-300 flex items-center justify-center transition-colors"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
