declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }

  namespace YT {
    class Player {
      constructor(
        elementIdOrElement: string | HTMLElement,
        options: PlayerOptions,
      );
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      loadVideoById(videoId: string, startSeconds?: number): void;
      cueVideoById(videoId: string): void;
      getCurrentTime(): number;
      getDuration(): number;
      getPlayerState(): number;
      setVolume(volume: number): void;
      getVolume(): number;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      destroy(): void;
    }

    interface PlayerOptions {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: PlayerVars;
      events?: PlayerEvents;
    }

    interface PlayerVars {
      autoplay?: 0 | 1;
      controls?: 0 | 1;
      enablejsapi?: 0 | 1;
      origin?: string;
      rel?: 0 | 1;
      modestbranding?: 0 | 1;
      playsinline?: 0 | 1;
      fs?: 0 | 1;
    }

    interface PlayerEvents {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: PlayerStateChangeEvent) => void;
      onError?: (event: PlayerEvent) => void;
    }

    interface PlayerEvent {
      target: Player;
    }

    interface PlayerStateChangeEvent extends PlayerEvent {
      data: number;
    }
  }
}

export {};
