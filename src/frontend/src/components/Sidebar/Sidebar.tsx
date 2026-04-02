import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Clock,
  Heart,
  Home,
  Music,
  Music2,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { useLocalPlaylists } from "../../hooks/useLocalQueries";
import { type Page, useNavigationStore } from "../../store/navigationStore";
import { usePlayerStore } from "../../store/playerStore";

const navItems: { label: string; page: Page; icon: React.ReactNode }[] = [
  { label: "Home", page: "home", icon: <Home className="w-5 h-5" /> },
  { label: "Search", page: "search", icon: <Search className="w-5 h-5" /> },
  {
    label: "Meel",
    page: "meel",
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    label: "Your Library",
    page: "library",
    icon: <BookOpen className="w-5 h-5" />,
  },
];

const secondaryItems: { label: string; page: Page; icon: React.ReactNode }[] = [
  { label: "Liked Songs", page: "liked", icon: <Heart className="w-5 h-5" /> },
  { label: "History", page: "history", icon: <Clock className="w-5 h-5" /> },
  {
    label: "Settings",
    page: "settings",
    icon: <Settings className="w-5 h-5" />,
  },
];

export function Sidebar() {
  const { page, navigate } = useNavigationStore();
  const { playlists, create } = useLocalPlaylists();

  const currentSong = usePlayerStore((s) => s.currentSong);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreatePlaylist = () => {
    if (!newName.trim()) return;
    create(newName.trim());
    setNewName("");
    setCreating(false);
  };

  return (
    <aside
      data-ocid="sidebar.panel"
      className="hidden lg:flex w-60 flex-shrink-0 h-full bg-sidebar flex-col border-r border-sidebar-border"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <Music2 className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground tracking-tight">
          Flute
        </span>
      </div>

      {/* Primary nav */}
      <nav className="px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.page}
            type="button"
            data-ocid={`nav.${item.page}.link`}
            onClick={() => navigate(item.page)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              page === item.page
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mx-3 my-3 border-t border-sidebar-border" />

      {/* Secondary nav */}
      <nav className="px-3 space-y-1">
        {secondaryItems.map((item) => (
          <button
            key={item.page}
            type="button"
            data-ocid={`nav.${item.page}.link`}
            onClick={() => navigate(item.page)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              page === item.page
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mx-3 my-3 border-t border-sidebar-border" />

      {/* Playlists */}
      <div className="flex items-center justify-between px-5 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Playlists
        </span>
        <button
          type="button"
          data-ocid="playlist.open_modal_button"
          onClick={() => setCreating(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Create playlist"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {creating && (
        <div className="px-3 mb-2">
          <input
            data-ocid="playlist.input"
            placeholder="Playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreatePlaylist();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            className="w-full px-3 py-1.5 rounded-md bg-accent text-foreground text-sm border border-border outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-1 mt-1">
            <button
              type="button"
              data-ocid="playlist.confirm_button"
              onClick={handleCreatePlaylist}
              disabled={!newName.trim()}
              className="flex-1 text-xs py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              data-ocid="playlist.cancel_button"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="flex-1 text-xs py-1 rounded bg-accent text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 px-3">
        {playlists.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-2">
            No playlists yet
          </p>
        ) : (
          playlists.map((pl, i) => (
            <button
              key={pl.id}
              type="button"
              data-ocid={`playlist.item.${i + 1}`}
              onClick={() => navigate("playlist", pl.id)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <Music className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{pl.name}</span>
            </button>
          ))
        )}
      </ScrollArea>

      {/* Now Playing mini (if song playing) */}
      {currentSong && (
        <button
          type="button"
          data-ocid="nowplaying.link"
          onClick={() => navigate("nowplaying")}
          className="mx-3 mb-3 p-2 rounded-lg bg-accent hover:bg-accent/80 transition-colors flex items-center gap-2 min-w-0"
        >
          <img
            src={currentSong.thumbnail}
            alt={currentSong.title}
            className="w-8 h-8 rounded object-cover flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">
              {currentSong.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentSong.channel}
            </p>
          </div>
        </button>
      )}
    </aside>
  );
}
