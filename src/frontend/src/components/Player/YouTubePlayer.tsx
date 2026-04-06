import { useEffect, useRef, useState } from "react";
import { useCacheSong, useRecordListening } from "../../hooks/useQueries";
import { pipedFetch, searchVideos } from "../../lib/invidious";
import { registerSeekCallback, usePlayerStore } from "../../store/playerStore";
import { addToLocalHistory } from "../../utils/localHistory";

interface PipedAudioStream {
  url: string;
  bitrate: number;
  mimeType: string;
}

interface PipedStreamsData {
  audioStreams: PipedAudioStream[];
  duration?: number;
}

export function YouTubePlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingVideoIdRef = useRef<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const next = usePlayerStore((s) => s.next);

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

  // Register seek callback
  useEffect(() => {
    registerSeekCallback((seconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = seconds;
      }
    });
  }, []);

  // Wire up audio element events once on mount
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => {
      if (
        audio.duration &&
        !Number.isNaN(audio.duration) &&
        audio.duration > 0
      ) {
        setDurationRef.current(audio.duration);
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
            searchVideos(`${song.title} ${song.channel}`)
              .then((results) => {
                const nextSong = results.find(
                  (r) => r.videoId !== song.videoId,
                );
                if (nextSong) usePlayerStore.getState().playSong(nextSong);
              })
              .catch(() => {});
          } else {
            setIsPlayingRef.current(false);
          }
        } else {
          nextRef.current();
        }
      }
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onError = (e: Event) => {
      const err = (e.target as HTMLAudioElement).error;
      console.warn("Audio error:", err?.code, err?.message);
      setIsBuffering(false);
      const song = currentSongRef.current;
      if (song && loadingVideoIdRef.current === song.videoId) {
        loadingVideoIdRef.current = null;
        setTimeout(() => {
          usePlayerStore.setState((s) => ({ ...s }));
        }, 500);
      }
    };
    const onStalled = () => setIsBuffering(true);

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
    };
  }, [setProgress]);

  // Load new stream when song changes -- triggered by videoId change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on videoId only; currentSong accessed via ref to avoid stale closures
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
