import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Heart,
  ListMusic,
  Music2,
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
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Song } from "../backend";
import {
  useCacheLyrics,
  useFetchLyrics,
  useLikeSong,
  useLikedSongs,
  useUnlikeSong,
} from "../hooks/useQueries";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";

const SKEL_5 = ["rs0", "rs1", "rs2", "rs3", "rs4"];

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function fetchRelatedSongs(
  videoId: string,
  apiKey: string,
): Promise<Song[]> {
  if (!apiKey) return [];
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&relatedToVideoId=${videoId}&key=${apiKey}&maxResults=10`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.items) return [];
    return (
      data.items as {
        id?: { videoId?: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { high?: { url: string }; default?: { url: string } };
        };
      }[]
    )
      .filter((item) => item.id?.videoId)
      .map(
        (item) =>
          ({
            videoId: item.id!.videoId!,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail:
              item.snippet.thumbnails?.high?.url ||
              item.snippet.thumbnails?.default?.url ||
              "",
            duration: "0:00",
          }) satisfies Song,
      );
  } catch {
    return [];
  }
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
    togglePlay,
    next,
    prev,
    seekTo,
    setVolume,
    toggleShuffle,
    setRepeat,
  } = usePlayerStore();
  const { goBack } = useNavigationStore();
  const { data: likedSongs = [] } = useLikedSongs();
  const likeSong = useLikeSong();
  const unlikeSong = useUnlikeSong();
  const cacheLyrics = useCacheLyrics();

  const [relatedSongs, setRelatedSongs] = useState<Song[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "related">(
    "lyrics",
  );

  const isLiked = currentSong
    ? likedSongs.some((s) => s.videoId === currentSong.videoId)
    : false;

  const { data: lyricsData = "", isLoading: lyricsLoading } = useFetchLyrics(
    currentSong?.channel || "",
    currentSong?.title || "",
    !!currentSong && !currentSong.lyrics,
  );

  const lyrics = currentSong?.lyrics || lyricsData;

  // Stable refs for mutations to avoid exhaustive deps issues
  const cacheLyricsRef = useRef(cacheLyrics.mutate);
  cacheLyricsRef.current = cacheLyrics.mutate;

  useEffect(() => {
    if (!lyricsData || !currentSong || currentSong.lyrics) return;
    cacheLyricsRef.current({ songId: currentSong.videoId, lyrics: lyricsData });
  }, [lyricsData, currentSong]);

  useEffect(() => {
    if (!currentSong) return;
    const apiKey = localStorage.getItem("yt_api_key") || "";
    if (!apiKey) return;
    setRelatedLoading(true);
    fetchRelatedSongs(currentSong.videoId, apiKey).then((songs) => {
      setRelatedSongs(songs);
      setRelatedLoading(false);
    });
  }, [currentSong]);

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
        <motion.img
          key={currentSong.videoId}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          src={currentSong.thumbnail}
          alt={currentSong.title}
          className="w-64 h-64 lg:w-72 lg:h-72 rounded-2xl object-cover shadow-card"
        />

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

      {/* Right: Lyrics/Queue/Related */}
      <div className="flex-1 min-w-0">
        <div className="flex gap-1 mb-6 bg-accent rounded-xl p-1 w-fit">
          {(["lyrics", "queue", "related"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              data-ocid={`nowplaying.${tab}.tab`}
              onClick={() => setActiveTab(tab)}
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

        {activeTab === "queue" && (
          <div data-ocid="nowplaying.panel">
            {queue.length === 0 ? (
              <div
                data-ocid="nowplaying.empty_state"
                className="text-center py-12"
              >
                <ListMusic className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Queue is empty</p>
              </div>
            ) : (
              <ScrollArea className="h-[50vh]">
                <div className="space-y-1">
                  {queue.map((song, i) => (
                    <button
                      key={song.videoId}
                      type="button"
                      data-ocid={`queue.item.${i + 1}`}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-accent text-left",
                        song.videoId === currentSong.videoId && "bg-primary/10",
                      )}
                      onClick={() =>
                        usePlayerStore.getState().playSong(song, queue)
                      }
                    >
                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            song.videoId === currentSong.videoId
                              ? "text-primary"
                              : "text-foreground",
                          )}
                        >
                          {song.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.channel}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {activeTab === "related" && (
          <div data-ocid="nowplaying.panel">
            {relatedLoading ? (
              <div data-ocid="nowplaying.loading_state" className="space-y-3">
                {SKEL_5.map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded bg-accent" />
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
                className="text-center py-12"
              >
                <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {localStorage.getItem("yt_api_key")
                    ? "No related songs found"
                    : "Set an API key in Settings to see related songs"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[50vh]">
                <div className="space-y-1">
                  {relatedSongs.map((song, i) => (
                    <button
                      key={song.videoId}
                      type="button"
                      data-ocid={`related.item.${i + 1}`}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent transition-colors group text-left"
                      onClick={() =>
                        usePlayerStore.getState().playSong(song, relatedSongs)
                      }
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-4 h-4 text-white fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {song.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.channel}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
