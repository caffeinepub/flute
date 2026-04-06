import { Toaster } from "@/components/ui/sonner";
import { Play, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Song } from "./backend";
import { BottomNav } from "./components/BottomNav";
import { PlayerBar } from "./components/Player/PlayerBar";
import { YouTubePlayer } from "./components/Player/YouTubePlayer";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { loadSavedTheme } from "./lib/theme";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { LikedSongs } from "./pages/LikedSongs";
import { Meel } from "./pages/Meel";
import { NowPlaying } from "./pages/NowPlaying";
import { PlaylistDetail } from "./pages/PlaylistDetail";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { useNavigationStore } from "./store/navigationStore";
import { loadLastSong, usePlayerStore } from "./store/playerStore";

// Apply saved theme on startup
loadSavedTheme();

interface MidSessionData {
  song: Song;
  queue: Song[];
  queueIndex: number;
  progress: number;
  savedAt: number;
}

function MainLayout() {
  const { page, navigate, playlistId } = useNavigationStore();
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [resumeData, setResumeData] = useState<MidSessionData | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail) navigate(detail as Parameters<typeof navigate>[0]);
    };
    window.addEventListener("flute-navigate", handler);
    return () => window.removeEventListener("flute-navigate", handler);
  }, [navigate]);

  // Resume last song on mount (paused)
  useEffect(() => {
    const saved = loadLastSong();
    if (saved) {
      usePlayerStore.setState({
        currentSong: saved.song,
        queue: saved.queue,
        queueIndex: saved.queueIndex,
        isPlaying: false,
      });
    }

    // Check for mid-session state (from switching away)
    const raw = localStorage.getItem("flute_mid_session");
    if (raw) {
      try {
        const data = JSON.parse(raw) as MidSessionData;
        const AGE_24H = 24 * 60 * 60 * 1000;
        if (Date.now() - data.savedAt < AGE_24H && data.song) {
          setResumeData(data);
          setShowResumeBanner(true);
        }
      } catch {
        // ignore malformed data
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save state when switching away
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        const { currentSong, queue, queueIndex, progress } =
          usePlayerStore.getState();
        if (currentSong) {
          localStorage.setItem(
            "flute_mid_session",
            JSON.stringify({
              song: currentSong,
              queue,
              queueIndex,
              progress,
              savedAt: Date.now(),
            }),
          );
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleResume = () => {
    if (!resumeData) return;
    usePlayerStore.getState().playSong(resumeData.song, resumeData.queue);
    // Seek after a short delay for the audio to load
    setTimeout(() => {
      usePlayerStore.getState().seekTo(resumeData.progress);
    }, 800);
    setShowResumeBanner(false);
    localStorage.removeItem("flute_mid_session");
  };

  const handleDismissResume = () => {
    setShowResumeBanner(false);
    localStorage.removeItem("flute_mid_session");
  };

  const isMeel = page === "meel";

  const renderPage = () => {
    switch (page) {
      case "home":
        return <Home />;
      case "search":
        return <Search />;
      case "library":
        return <Library />;
      case "playlist":
        return <PlaylistDetail playlistId={playlistId} />;
      case "liked":
        return <LikedSongs />;
      case "history":
        return <History />;
      case "settings":
        return <Settings />;
      case "nowplaying":
        return <NowPlaying />;
      case "meel":
        return <Meel />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main
          className={
            isMeel
              ? "flex-1 overflow-hidden"
              : "flex-1 overflow-y-auto pb-24 lg:pb-24 pb-40"
          }
        >
          {/* Resume banner */}
          <AnimatePresence>
            {showResumeBanner && resumeData && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                data-ocid="resume.panel"
                className="mx-4 mt-3 bg-primary/15 border border-primary/30 rounded-xl px-4 py-2 flex items-center gap-3 text-sm"
              >
                <Play className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1 text-foreground truncate">
                  Resume{" "}
                  <span className="font-semibold text-primary">
                    &ldquo;{resumeData.song.title}&rdquo;
                  </span>
                </span>
                <button
                  type="button"
                  data-ocid="resume.primary_button"
                  onClick={handleResume}
                  className="text-xs font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors shrink-0"
                >
                  Resume
                </button>
                <button
                  type="button"
                  data-ocid="resume.close_button"
                  onClick={handleDismissResume}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {renderPage()}
        </main>
      </div>
      <YouTubePlayer />
      <PlayerBar />
      <BottomNav />
      <Toaster position="top-right" />
    </div>
  );
}

export default function App() {
  return <MainLayout />;
}
