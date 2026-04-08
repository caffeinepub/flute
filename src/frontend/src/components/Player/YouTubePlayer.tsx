import { useCallback, useEffect, useRef, useState } from "react";
import { useCacheSong, useRecordListening } from "../../hooks/useQueries";
import { pipedFetch } from "../../lib/invidious";
import {
  registerSeekCallback,
  sessionPlayedIds,
  usePlayerStore,
} from "../../store/playerStore";
import { addToLocalHistory } from "../../utils/localHistory";
import {
  fetchRelatedSongs,
  refetchStreamData,
} from "../../utils/pipedRecommendations";

interface PipedAudioStream {
  url: string;
  bitrate: number;
  mimeType: string;
}

interface PipedStreamsData {
  audioStreams: PipedAudioStream[];
  duration?: number;
}

// How long to wait before re-triggering sticky notification (ms)
const STICKY_NOTIFICATION_DELAY = 4000;
// Max retries for broken streams (duration=0 or error)
const MAX_STREAM_RETRIES = 2;

export function YouTubePlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingVideoIdRef = useRef<string | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ISSUE 3 FIX: track retry count per videoId
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const [isBuffering, setIsBuffering] = useState(false);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const stickyNotification = usePlayerStore((s) => s.stickyNotification);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const next = usePlayerStore((s) => s.next);
  const markBroken = usePlayerStore((s) => s.markBroken);

  const recordListening = useRecordListening();
  const cacheSong = useCacheSong();

  const nextRef = useRef(next);
  nextRef.current = next;
  const setIsPlayingRef = useRef(setIsPlaying);
  setIsPlayingRef.current = setIsPlaying;
  const setDurationRef = useRef(setDuration);
  setDurationRef.current = setDuration;
  const cacheSongRef = useRef(cacheSong.mutate);
  cacheSongRef.current = cacheSong.mutate;
  const recordRef = useRef(recordListening.mutate);
  recordRef.current = recordListening.mutate;
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;
  const markBrokenRef = useRef(markBroken);
  markBrokenRef.current = markBroken;
  const stickyNotificationRef = useRef(stickyNotification);
  stickyNotificationRef.current = stickyNotification;

  // Register seek callback
  useEffect(() => {
    registerSeekCallback((seconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = seconds;
      }
    });
  }, []);

  // ISSUE 3 FIX: helper to retry stream fetch from different instances
  const retryStream = useCallback(async (videoId: string) => {
    const retries = retryCountRef.current.get(videoId) ?? 0;
    if (retries >= MAX_STREAM_RETRIES) {
      // Exhausted retries — mark broken
      markBrokenRef.current(videoId);
      return;
    }
    retryCountRef.current.set(videoId, retries + 1);

    const data = await refetchStreamData(videoId);
    if (!data || !data.streamUrl || data.duration <= 0) {
      // Still bad — mark broken
      markBrokenRef.current(videoId);
      return;
    }

    const audio = audioRef.current;
    if (!audio || loadingVideoIdRef.current !== videoId) return;

    setDurationRef.current(data.duration);
    audio.pause();
    audio.src = data.streamUrl;
    audio.load();

    if (usePlayerStore.getState().isPlaying) {
      audio.play().catch(() => {});
    }
  }, []);

  // FIX 8 — Helper: mark broken and clear stall timer
  const handleBroken = useCallback(
    (videoId: string) => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      // ISSUE 3 FIX: try retry first before marking broken
      retryStream(videoId);
    },
    [retryStream],
  );

  // Wire up audio element events once on mount
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
    const onLoadedMetadata = () => {
      if (
        audio.duration &&
        !Number.isNaN(audio.duration) &&
        audio.duration > 0
      ) {
        setDurationRef.current(audio.duration);
        // Reset retry counter on success
        const song = currentSongRef.current;
        if (song) retryCountRef.current.delete(song.videoId);
      } else {
        // ISSUE 3 FIX: duration is 0 after metadata load → retry stream fetch
        const song = currentSongRef.current;
        if (song) handleBroken(song.videoId);
      }
    };
    const onDurationChange = () => {
      if (
        audio.duration &&
        !Number.isNaN(audio.duration) &&
        audio.duration > 0
      ) {
        setDurationRef.current(audio.duration);
      }
    };
    const onPlay = () => setIsPlayingRef.current(true);
    const onPause = () => setIsPlayingRef.current(false);
    const onEnded = () => {
      const { repeat, queue, queueIndex } = usePlayerStore.getState();
      if (repeat === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        const isAtEnd = queueIndex >= queue.length - 1 && repeat !== "all";
        if (isAtEnd) {
          const song = currentSongRef.current;
          if (song) {
            // ISSUE 5 FIX: pass sessionPlayedIds so we never repeat already-heard songs
            fetchRelatedSongs(
              song.videoId,
              song.title,
              song.channel,
              sessionPlayedIds,
            )
              .then((results) => {
                // Filter out any IDs already in session history
                const fresh = results.filter(
                  (r) =>
                    r.videoId !== song.videoId &&
                    !sessionPlayedIds.has(r.videoId),
                );
                const nextSong = fresh[0] ?? results[0];
                if (nextSong) {
                  usePlayerStore
                    .getState()
                    .appendSimilarToQueue(fresh.length > 0 ? fresh : results);
                  const updatedQueue = usePlayerStore.getState().queue;
                  usePlayerStore.getState().playSong(nextSong, updatedQueue);
                } else {
                  setIsPlayingRef.current(false);
                }
              })
              .catch(() => {
                setIsPlayingRef.current(false);
              });
          } else {
            setIsPlayingRef.current(false);
          }
        } else {
          nextRef.current();
        }
      }
    };
    const onWaiting = () => {
      setIsBuffering(true);
      // If stalled for 3+ seconds with no progress, trigger retry
      const song = currentSongRef.current;
      if (song) {
        stallTimerRef.current = setTimeout(() => {
          const currentAudio = audioRef.current;
          if (
            currentAudio &&
            currentAudio.readyState < 3 &&
            !currentAudio.paused
          ) {
            handleBroken(song.videoId);
          }
        }, 3000);
      }
    };
    const onCanPlay = () => {
      setIsBuffering(false);
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
    const onError = (e: Event) => {
      const err = (e.target as HTMLAudioElement).error;
      console.warn("Audio error:", err?.code, err?.message);
      setIsBuffering(false);
      const song = currentSongRef.current;
      if (song && loadingVideoIdRef.current === song.videoId) {
        // ISSUE 3 FIX: retry before marking broken
        handleBroken(song.videoId);
        loadingVideoIdRef.current = null;
      }
    };
    const onStalled = () => {
      setIsBuffering(true);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("canplaythrough", onCanPlay);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("error", onError);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [setProgress, handleBroken]);

  // Load new stream when song changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on videoId only
  useEffect(() => {
    const song = currentSongRef.current;
    const videoId = song?.videoId ?? null;

    if (loadingVideoIdRef.current === videoId && videoId !== null) return;
    loadingVideoIdRef.current = videoId;

    const audio = audioRef.current;
    if (!audio) return;

    if (!videoId || !song) {
      audio.pause();
      audio.src = "";
      setIsBuffering(false);
      return;
    }

    setIsBuffering(true);
    cacheSongRef.current(song);
    recordRef.current(song.videoId);
    addToLocalHistory(song);
    // ISSUE 5 FIX: mark this song as played in session
    sessionPlayedIds.add(videoId);
    // Reset retry counter for new song
    retryCountRef.current.delete(videoId);

    // Auto-fill queue with similar songs in the background
    fetchRelatedSongs(song.videoId, song.title, song.channel, sessionPlayedIds)
      .then((similar) => {
        if (similar.length > 0) {
          usePlayerStore.getState().appendSimilarToQueue(similar);
        }
      })
      .catch(() => {});

    const fetchingId = videoId;

    pipedFetch(`/streams/${fetchingId}`)
      .then((data) => {
        if (loadingVideoIdRef.current !== fetchingId) return;

        const d = data as PipedStreamsData;

        if (d.duration && d.duration > 0) {
          setDurationRef.current(d.duration);
        }

        const streams = d.audioStreams ?? [];
        if (streams.length === 0) throw new Error("No audio streams");

        const sorted = [...streams].sort(
          (a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0),
        );
        const mp4 = sorted.find((s) => s.mimeType?.includes("audio/mp4"));
        const webm = sorted.find((s) => s.mimeType?.includes("audio/webm"));
        const best = mp4 ?? webm ?? sorted[0];

        audio.pause();
        audio.src = best.url;
        audio.load();

        if (usePlayerStore.getState().isPlaying) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn("Autoplay blocked:", err);
            });
          }
        }
      })
      .catch((err) => {
        if (loadingVideoIdRef.current !== fetchingId) return;
        console.error("Stream fetch failed:", err);
        setIsBuffering(false);
        setIsPlayingRef.current(false);
        // ISSUE 3 FIX: retry before marking broken
        handleBroken(fetchingId);
      });
  }, [currentSong]);

  // Sync play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      const p = audio.play();
      if (p !== undefined) p.catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Media Session API
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.channel,
      artwork: [
        { src: currentSong.thumbnail, sizes: "512x512", type: "image/jpeg" },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play().catch(() => {});
      setIsPlayingRef.current(true);
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
      setIsPlayingRef.current(false);
    });
    navigator.mediaSession.setActionHandler("nexttrack", () =>
      nextRef.current(),
    );
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      if (audioRef.current) audioRef.current.currentTime = 0;
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
  }, [currentSong]);

  // Keep mediaSession playback state in sync
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Update mediaSession position state
  useEffect(() => {
    if (!("mediaSession" in navigator) || !audioRef.current) return;
    const audio = audioRef.current;
    const updatePosition = () => {
      if (audio.duration && !Number.isNaN(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        } catch {
          // ignore if not supported
        }
      }
    };
    audio.addEventListener("timeupdate", updatePosition);
    return () => audio.removeEventListener("timeupdate", updatePosition);
  }, []);

  // Sticky notification: re-trigger Media Session metadata on visibility change
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const handleVisibilityChange = () => {
      if (document.hidden) return;

      if (
        stickyNotificationRef.current &&
        usePlayerStore.getState().isPlaying
      ) {
        if (stickyTimerRef.current) clearTimeout(stickyTimerRef.current);
        stickyTimerRef.current = setTimeout(() => {
          const song = currentSongRef.current;
          if (!song || !("mediaSession" in navigator)) return;
          navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.channel,
            artwork: [
              { src: song.thumbnail, sizes: "512x512", type: "image/jpeg" },
            ],
          });
          try {
            const audio = audioRef.current;
            if (audio?.duration && !Number.isNaN(audio.duration)) {
              navigator.mediaSession.setPositionState({
                duration: audio.duration,
                playbackRate: audio.playbackRate,
                position: audio.currentTime,
              });
            }
          } catch {}
        }, STICKY_NOTIFICATION_DELAY);
      }
    };

    const stickyPoll = setInterval(() => {
      if (!stickyNotificationRef.current) return;
      if (!usePlayerStore.getState().isPlaying) return;
      const song = currentSongRef.current;
      if (!song) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.channel,
          artwork: [
            { src: song.thumbnail, sizes: "512x512", type: "image/jpeg" },
          ],
        });
      } catch {}
    }, 5000);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(stickyPoll);
      if (stickyTimerRef.current) clearTimeout(stickyTimerRef.current);
    };
  }, []);

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: hidden audio player for music streaming */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        style={{ display: "none" }}
      />
      {isBuffering && currentSong && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "none",
          }}
          className="bg-black/70 text-white text-xs px-3 py-1 rounded-full"
        >
          Loading…
        </div>
      )}
    </>
  );
}
