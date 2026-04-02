import { useEffect, useRef, useState } from "react";
import { useCacheSong, useRecordListening } from "../../hooks/useQueries";
import { getStreamUrl, searchVideos } from "../../lib/invidious";
import { registerSeekCallback, usePlayerStore } from "../../store/playerStore";
import { addToLocalHistory } from "../../utils/localHistory";

export function YouTubePlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevVideoIdRef = useRef<string | null>(null);
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

  // Register seek callback for the NowPlaying seek slider
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
    const onLoadedMetadata = () => setDurationRef.current(audio.duration);
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
    const onError = () => {
      setIsBuffering(false);
      setIsPlayingRef.current(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
    };
  }, [setProgress]);

  // Load new stream when song changes
  useEffect(() => {
    const videoId = currentSong?.videoId ?? null;
    if (prevVideoIdRef.current === videoId) return;
    prevVideoIdRef.current = videoId;

    const audio = audioRef.current;
    if (!audio) return;

    if (!videoId || !currentSong) {
      audio.pause();
      audio.src = "";
      return;
    }

    setIsBuffering(true);
    cacheSongRef.current(currentSong);
    recordRef.current(currentSong.videoId);
    addToLocalHistory(currentSong);

    getStreamUrl(videoId)
      .then((url) => {
        audio.src = url;
        audio.load();
        if (usePlayerStore.getState().isPlaying) {
          return audio.play();
        }
      })
      .catch(() => {
        setIsBuffering(false);
        setIsPlayingRef.current(false);
      });
  }, [currentSong]);

  // Sync play/pause state changes (when same song)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const videoId = currentSong?.videoId ?? null;
    if (prevVideoIdRef.current !== videoId) return;
    if (!audio.src) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong?.videoId]);

  // Volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Media Session API -- works with native <audio> elements
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
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
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

  // Update mediaSession position state for lock screen scrubber
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
          Buffering…
        </div>
      )}
    </>
  );
}
