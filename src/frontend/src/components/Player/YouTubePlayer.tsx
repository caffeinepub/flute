import { useEffect, useRef } from "react";
import { useCacheSong, useRecordListening } from "../../hooks/useQueries";
import { registerSeekCallback, usePlayerStore } from "../../store/playerStore";

export function YouTubePlayer() {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevVideoIdRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const next = usePlayerStore((s) => s.next);

  const recordListening = useRecordListening();
  const cacheSong = useCacheSong();

  // Stable refs so YT event handlers don't go stale
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

  // Register seek callback
  useEffect(() => {
    registerSeekCallback((seconds: number) => {
      playerRef.current?.seekTo(seconds, true);
    });
  }, []);

  // Load YT API - intentionally runs once on mount
  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;
      const player = new window.YT.Player(containerRef.current, {
        height: "1",
        width: "1",
        videoId: "",
        playerVars: {
          autoplay: 0,
          controls: 0,
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            player.setVolume(usePlayerStore.getState().volume * 100);
          },
          onStateChange: (event) => {
            const state = event.data;
            if (state === 0) {
              const { repeat: currentRepeat } = usePlayerStore.getState();
              if (currentRepeat === "one") {
                player.seekTo(0, true);
                player.playVideo();
              } else {
                nextRef.current();
              }
            } else if (state === 1) {
              setIsPlayingRef.current(true);
              const dur = player.getDuration();
              if (dur) setDurationRef.current(dur);
            } else if (state === 2) {
              setIsPlayingRef.current(false);
            }
          },
          onError: () => {
            setIsPlayingRef.current(false);
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector("script[src*='youtube.com/iframe_api']")) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }
  }, []);

  // Handle song change
  useEffect(() => {
    if (!playerRef.current) return;
    const videoId = currentSong?.videoId ?? null;
    const isSongChange = prevVideoIdRef.current !== videoId;
    if (!isSongChange) return;

    prevVideoIdRef.current = videoId;
    if (videoId) {
      if (usePlayerStore.getState().isPlaying) {
        playerRef.current.loadVideoById(videoId);
      } else {
        playerRef.current.cueVideoById(videoId);
      }
      if (currentSong) {
        cacheSongRef.current(currentSong);
        recordRef.current(currentSong.videoId);
      }
    } else {
      playerRef.current.stopVideo();
    }
  }, [currentSong]);

  // Handle play/pause toggle
  useEffect(() => {
    if (!playerRef.current) return;
    const videoId = currentSong?.videoId ?? null;
    if (prevVideoIdRef.current !== videoId) return;
    if (isPlaying) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying, currentSong?.videoId]);

  // Sync volume
  useEffect(() => {
    playerRef.current?.setVolume(volume * 100);
  }, [volume]);

  // Progress polling
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = window.setInterval(() => {
        if (playerRef.current) {
          const current = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration();
          setProgress(current || 0);
          if (dur && dur > 0) setDuration(dur);
        }
      }, 1000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, setProgress, setDuration]);

  return (
    <div
      style={{
        position: "fixed",
        top: "-1px",
        left: "-1px",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <div ref={containerRef} />
    </div>
  );
}
