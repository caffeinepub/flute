import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Heart, Loader2, Music2, Plus, SkipForward } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "../backend";
import {
  useAddSongToPlaylist,
  useAllPlaylists,
  useLikeSong,
  useLikedSongs,
  useUnlikeSong,
} from "../hooks/useQueries";
import { usePlayerStore } from "../store/playerStore";

function parseISO8601DurationSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = Number.parseInt(match[1] || "0");
  const m = Number.parseInt(match[2] || "0");
  const s = Number.parseInt(match[3] || "0");
  return h * 3600 + m * 60 + s;
}

const BLOCKED_KEYWORDS = ["live", "reaction", "cover", "vlog"];

function isMusicVideo(title: string, durationSeconds: number): boolean {
  if (durationSeconds < 120) return false;
  const lower = title.toLowerCase();
  return !BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

async function fetchMeelTracks(apiKey: string): Promise<Song[]> {
  const trendingUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=10&regionCode=US&maxResults=20&key=${apiKey}`;

  const genres: string[] = (() => {
    try {
      const stored = localStorage.getItem("flute_favorite_genres");
      if (stored) return JSON.parse(stored) as string[];
    } catch {
      // ignore
    }
    return [];
  })();

  const fetches: Promise<Response>[] = [fetch(trendingUrl)];

  for (const genre of genres.slice(0, 3)) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(`${genre} official audio`)}&key=${apiKey}&maxResults=5`;
    fetches.push(fetch(url));
  }

  const responses = await Promise.all(fetches);
  const jsons = await Promise.all(responses.map((r) => r.json()));

  const allVideoIds: string[] = [];
  const snippetMap: Record<
    string,
    {
      title: string;
      channelTitle: string;
      thumbnails: { high?: { url: string }; default?: { url: string } };
    }
  > = {};

  // Process trending (videos endpoint)
  const trendingData = jsons[0];
  if (trendingData.items) {
    for (const item of trendingData.items as Array<{
      id: string;
      snippet: {
        title: string;
        channelTitle: string;
        thumbnails: { high?: { url: string }; default?: { url: string } };
      };
      contentDetails: { duration: string };
    }>) {
      const secs = parseISO8601DurationSeconds(item.contentDetails.duration);
      if (isMusicVideo(item.snippet.title, secs)) {
        allVideoIds.push(item.id);
        snippetMap[item.id] = item.snippet;
      }
    }
  }

  // Process genre searches (search endpoint - need to fetch details)
  const genreVideoIds: string[] = [];
  for (let i = 1; i < jsons.length; i++) {
    const data = jsons[i];
    if (data.items) {
      for (const item of data.items as Array<{
        id?: { videoId?: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { high?: { url: string }; default?: { url: string } };
        };
      }>) {
        if (item.id?.videoId) {
          genreVideoIds.push(item.id.videoId);
          snippetMap[item.id.videoId] = item.snippet;
        }
      }
    }
  }

  if (genreVideoIds.length > 0) {
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${genreVideoIds.join(",")}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();
    if (detailsData.items) {
      for (const item of detailsData.items as Array<{
        id: string;
        contentDetails: { duration: string };
      }>) {
        const secs = parseISO8601DurationSeconds(item.contentDetails.duration);
        if (
          snippetMap[item.id] &&
          isMusicVideo(snippetMap[item.id].title, secs)
        ) {
          allVideoIds.push(item.id);
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const songs: Song[] = [];
  for (const id of allVideoIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const snippet = snippetMap[id];
    if (!snippet) continue;
    songs.push({
      videoId: id,
      title: snippet.title,
      channel: snippet.channelTitle,
      thumbnail:
        snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || "",
      duration: "",
    });
  }

  return songs.slice(0, 20);
}

interface MeelCardProps {
  song: Song;
  index: number;
  isActive: boolean;
  onNext: () => void;
}

function MeelCard({ song, index, isActive, onNext }: MeelCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const autoAdvanceRef = useRef<number | null>(null);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;
  const playSong = usePlayerStore((s) => s.playSong);

  const { data: likedSongs = [] } = useLikedSongs();
  const likeSong = useLikeSong();
  const unlikeSong = useUnlikeSong();
  const { data: playlists = [] } = useAllPlaylists();
  const addSongToPlaylist = useAddSongToPlaylist();
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const isLiked = likedSongs.some((s) => s.videoId === song.videoId);

  const handleLike = () => {
    if (isLiked) {
      unlikeSong.mutate(song.videoId);
    } else {
      likeSong.mutate(song.videoId);
    }
  };

  // Initialize YT player on this iframe
  useEffect(() => {
    const iframeId = `meel-iframe-${index}`;

    const createPlayer = () => {
      if (!iframeRef.current) return;
      playerRef.current = new window.YT.Player(iframeId, {
        events: {
          onStateChange: (event: { data: number }) => {
            if (event.data === 0) {
              onNextRef.current();
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        createPlayer();
      };
    }

    return () => {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: onNext captured via stable ref
  }, [index]);

  // Activate/deactivate based on isActive
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isActive) {
      try {
        player.loadVideoById(song.videoId, 60);
        playSong(song);
      } catch {
        // player not ready yet
      }

      // Auto-advance after 45s
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
      autoAdvanceRef.current = window.setInterval(() => {
        try {
          const currentTime = player.getCurrentTime();
          if (currentTime - 60 >= 45) {
            clearInterval(autoAdvanceRef.current!);
            autoAdvanceRef.current = null;
            onNext();
          }
        } catch {
          // ignore
        }
      }, 1000);
    } else {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
      try {
        player.pauseVideo();
      } catch {
        // ignore
      }
    }

    return () => {
      if (autoAdvanceRef.current) {
        clearInterval(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [isActive, song, onNext, playSong]);

  const iframeId = `meel-iframe-${index}`;
  const embedUrl = `https://www.youtube.com/embed/${song.videoId}?autoplay=0&controls=0&rel=0&enablejsapi=1&modestbranding=1&playsinline=1&mute=0&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div
      data-ocid={`meel.item.${index + 1}`}
      style={{
        height: "100vh",
        scrollSnapAlign: "start",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Video background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <iframe
          id={iframeId}
          ref={iframeRef}
          src={embedUrl}
          title={song.title}
          allow="autoplay; encrypted-media"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "100vw",
            height: "56.25vw",
            minHeight: "100vh",
            minWidth: "177.77vh",
            transform: "translate(-50%, -50%)",
            border: "none",
          }}
        />
      </div>

      {/* Top gradient + Meel label */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "20%",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
          pointerEvents: "none",
        }}
      />
      <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-white text-sm font-semibold tracking-widest opacity-80">
          MEEL
        </span>
      </div>

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "40%",
          background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
          pointerEvents: "none",
        }}
      />

      {/* Bottom left: song info */}
      <div className="absolute bottom-24 left-4 right-20 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ animation: isActive ? "spin 3s linear infinite" : "none" }}
          >
            <Music2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-base truncate leading-tight">
              {song.title}
            </p>
            <p className="text-white/70 text-sm truncate">{song.channel}</p>
          </div>
        </div>
      </div>

      {/* Bottom right: action buttons */}
      <div className="absolute bottom-24 right-4 flex flex-col items-center gap-5">
        {/* Like */}
        <button
          type="button"
          data-ocid={`meel.toggle.${index + 1}`}
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
        >
          <div
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors",
              isLiked ? "bg-primary" : "bg-black/40",
            )}
          >
            <Heart
              className={cn(
                "w-5 h-5",
                isLiked ? "fill-white text-white" : "text-white",
              )}
            />
          </div>
          <span className="text-white text-xs">
            {isLiked ? "Liked" : "Like"}
          </span>
        </button>

        {/* Add to playlist */}
        <Dialog open={playlistOpen} onOpenChange={setPlaylistOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              data-ocid={`meel.open_modal_button.${index + 1}`}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xs">Save</span>
            </button>
          </DialogTrigger>
          <DialogContent
            data-ocid={`meel.dialog.${index + 1}`}
            className="bg-card border-border max-w-xs"
          >
            <DialogHeader>
              <DialogTitle className="text-foreground text-sm">
                Add to Playlist
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No playlists yet
                </p>
              ) : (
                playlists.map((pl, pi) => (
                  <button
                    key={pl.id.toString()}
                    type="button"
                    data-ocid={`meel.playlist.item.${pi + 1}`}
                    onClick={() => {
                      addSongToPlaylist.mutate({
                        playlistId: pl.id,
                        songId: song.videoId,
                      });
                      setPlaylistOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {pl.name}
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Skip */}
        <button
          type="button"
          data-ocid={`meel.secondary_button.${index + 1}`}
          onClick={onNext}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <SkipForward className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs">Skip</span>
        </button>
      </div>
    </div>
  );
}

export function Meel() {
  const [tracks, setTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const apiKey = localStorage.getItem("yt_api_key") || "";

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => {
      const next = Math.min(prev + 1, tracks.length - 1);
      if (containerRef.current && tracks.length > 0) {
        const cards = containerRef.current.children;
        if (cards[next]) {
          (cards[next] as HTMLElement).scrollIntoView({ behavior: "smooth" });
        }
      }
      return next;
    });
  }, [tracks.length]);

  useEffect(() => {
    if (!apiKey) {
      setError("no_api_key");
      setLoading(false);
      return;
    }

    fetchMeelTracks(apiKey)
      .then((songs) => {
        setTracks(songs);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || "Failed to load");
        setLoading(false);
      });
  }, [apiKey]);

  // Intersection observer to detect active card
  useEffect(() => {
    if (!containerRef.current || tracks.length === 0) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number.parseInt(
              (entry.target as HTMLElement).dataset.cardIndex || "0",
            );
            setActiveIndex(idx);
          }
        }
      },
      { threshold: 0.7 },
    );

    const cards = containerRef.current.children;
    for (let i = 0; i < cards.length; i++) {
      (cards[i] as HTMLElement).dataset.cardIndex = String(i);
      observerRef.current.observe(cards[i]);
    }

    return () => observerRef.current?.disconnect();
  }, [tracks]);

  if (loading) {
    return (
      <div
        data-ocid="meel.loading_state"
        className="h-screen bg-black flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-white/60 text-sm">Loading Meel...</p>
        </div>
      </div>
    );
  }

  if (error === "no_api_key") {
    return (
      <div
        data-ocid="meel.error_state"
        className="h-screen bg-black flex items-center justify-center px-6"
      >
        <div className="text-center space-y-4">
          <Music2 className="w-16 h-16 text-primary mx-auto" />
          <h2 className="text-white text-xl font-bold">Set Up Your API Key</h2>
          <p className="text-white/60 text-sm">
            To use Meel, set your YouTube API key in Settings.
          </p>
          <Button
            data-ocid="meel.primary_button"
            className="rounded-full bg-primary text-primary-foreground"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("flute-navigate", { detail: "settings" }),
              );
            }}
          >
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-ocid="meel.error_state"
        className="h-screen bg-black flex items-center justify-center"
      >
        <p className="text-white/60 text-sm">{error}</p>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div
        data-ocid="meel.empty_state"
        className="h-screen bg-black flex items-center justify-center"
      >
        <p className="text-white/60 text-sm">
          No tracks found. Try again later.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-ocid="meel.section"
      style={{
        height: "100vh",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
      }}
    >
      {tracks.slice(0, 10).map((song, i) => (
        <MeelCard
          key={song.videoId}
          song={song}
          index={i}
          isActive={activeIndex === i}
          onNext={goToNext}
        />
      ))}
    </div>
  );
}
