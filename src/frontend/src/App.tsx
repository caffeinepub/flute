import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, Music2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { PlayerBar } from "./components/Player/PlayerBar";
import { YouTubePlayer } from "./components/Player/YouTubePlayer";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useSaveProfile, useUserProfile } from "./hooks/useQueries";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { LikedSongs } from "./pages/LikedSongs";
import { NowPlaying } from "./pages/NowPlaying";
import { PlaylistDetail } from "./pages/PlaylistDetail";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { useNavigationStore } from "./store/navigationStore";

function SignInPage() {
  const { login, isLoggingIn } = useInternetIdentity();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-8 p-10 bg-card rounded-2xl shadow-card w-full max-w-sm mx-4"
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
            Sign in to Flute
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your personal music universe
          </p>
        </div>
        <Button
          data-ocid="signin.primary_button"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-12 rounded-full"
          onClick={() => login()}
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...
            </>
          ) : (
            "Continue with Internet Identity"
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Secure, private, decentralized authentication
        </p>
      </motion.div>
    </div>
  );
}

function ProfileSetup({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const saveProfile = useSaveProfile();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await saveProfile.mutateAsync({ name: name.trim() });
    onComplete();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 p-10 bg-card rounded-2xl shadow-card w-full max-w-sm mx-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Music2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">Flute</span>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            What should we call you?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set up your display name
          </p>
        </div>
        <Input
          data-ocid="profile.input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="bg-accent border-border text-foreground h-11"
          autoFocus
        />
        <Button
          data-ocid="profile.submit_button"
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11 rounded-full"
          onClick={handleSubmit}
          disabled={!name.trim() || saveProfile.isPending}
        >
          {saveProfile.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Get Started"
          )}
        </Button>
      </motion.div>
    </div>
  );
}

function ApiKeyBanner() {
  const { navigate } = useNavigationStore();
  return (
    <div
      data-ocid="api_key.error_state"
      className="flex items-center justify-between px-6 py-2 bg-yellow-900/40 border-b border-yellow-700/40 text-yellow-300 text-xs"
    >
      <span>
        ⚠ No YouTube API key set. Search and related songs won&apos;t work.
      </span>
      <button
        type="button"
        className="underline hover:text-yellow-100 ml-4"
        onClick={() => navigate("settings")}
      >
        Go to Settings
      </button>
    </div>
  );
}

function MainLayout() {
  const { page, playlistId } = useNavigationStore();
  const apiKey = localStorage.getItem("yt_api_key");

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
      default:
        return <Home />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {!apiKey && page !== "settings" && <ApiKeyBanner />}
        <main className="flex-1 overflow-y-auto pb-24">{renderPage()}</main>
      </div>
      <YouTubePlayer />
      <PlayerBar />
      <Toaster position="top-right" />
    </div>
  );
}

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const {
    data: profile,
    isLoading: profileLoading,
    refetch,
  } = useUserProfile();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Music2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!identity) return <SignInPage />;

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <ProfileSetup onComplete={() => refetch()} />;
  }

  return <MainLayout />;
}
