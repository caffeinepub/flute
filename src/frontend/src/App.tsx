import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { Music2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { PlayerBar } from "./components/Player/PlayerBar";
import { YouTubePlayer } from "./components/Player/YouTubePlayer";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useLocalAuth } from "./hooks/useLocalAuth";
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

function SignInPage() {
  const { login, loginAsGuest } = useLocalAuth();
  const [username, setUsername] = useState("");

  const handleLogin = () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    login(trimmed);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6 p-10 bg-card rounded-2xl shadow-card w-full max-w-sm mx-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Music2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-3xl font-bold tracking-tight text-foreground">
            Flute
          </span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Welcome to Flute
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your personal music universe
          </p>
        </div>
        <div className="w-full space-y-3">
          <Input
            data-ocid="signin.username_input"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="bg-accent border-border text-foreground h-11"
            autoFocus
          />
          <Button
            data-ocid="signin.primary_button"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-12 rounded-full"
            onClick={handleLogin}
            disabled={!username.trim()}
          >
            Get Started
          </Button>
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Button
            data-ocid="signin.guest_button"
            variant="outline"
            className="w-full h-11 rounded-full border-border text-foreground hover:bg-accent"
            onClick={loginAsGuest}
          >
            Continue as Guest
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Your data is stored locally in your browser.
        </p>
      </motion.div>
    </div>
  );
}

function MainLayout() {
  const { page, navigate, playlistId } = useNavigationStore();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const { user } = useLocalAuth();

  if (!user) return <SignInPage />;

  return <MainLayout />;
}
