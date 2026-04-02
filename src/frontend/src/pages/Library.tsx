import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  Edit2,
  Library as LibraryIcon,
  Music,
  Plus,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { SongCard } from "../components/SongCard/SongCard";
import { useLocalPlaylists } from "../hooks/useLocalQueries";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";
import { getLocalHistory } from "../utils/localHistory";
import type { HistoryEntry } from "../utils/localHistory";

const EMPTY_SLOTS = ["e0", "e1", "e2", "e3"];

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getDateGroup(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return "This Week";
  return "Earlier";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Earlier"];

export function Library() {
  const {
    playlists,
    create,
    remove,
    rename,
    refresh: refreshPlaylists,
  } = useLocalPlaylists();
  const { navigate } = useNavigationStore();

  const [activeTab, setActiveTab] = useState<"playlists" | "history">(
    "playlists",
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // History from local storage
  const history: HistoryEntry[] = getLocalHistory();

  // Get song cache for playlist thumbnails
  const songCache: Record<
    string,
    {
      videoId: string;
      title: string;
      thumbnail: string;
      channel: string;
      duration: string;
    }
  > = JSON.parse(localStorage.getItem("flute_song_cache") || "{}");

  const handleCreate = () => {
    if (!newName.trim()) return;
    create(newName.trim());
    setNewName("");
    setShowCreate(false);
    toast.success("Playlist created");
  };

  const handleRename = () => {
    if (!renameId || !renameName.trim()) return;
    rename(renameId, renameName.trim());
    setRenameId(null);
    toast.success("Playlist renamed");
    refreshPlaylists();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    remove(deleteId);
    setDeleteId(null);
    toast.success("Playlist deleted");
  };

  // Group history
  const grouped: Record<string, HistoryEntry[]> = {};
  for (const entry of history) {
    const group = getDateGroup(entry.timestamp);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(entry);
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Your Library</h1>
        {activeTab === "playlists" && (
          <Button
            data-ocid="library.open_modal_button"
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-9 px-4"
          >
            <Plus className="w-4 h-4 mr-1" /> New Playlist
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-accent rounded-xl p-1 w-fit">
        {(["playlists", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            data-ocid={`library.${tab}.tab`}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Playlists tab */}
      {activeTab === "playlists" && (
        <div>
          {playlists.length === 0 ? (
            <motion.div
              data-ocid="library.empty_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <LibraryIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Create your first playlist
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Save songs and organize your music
              </p>
              <Button
                data-ocid="library.primary_button"
                onClick={() => setShowCreate(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" /> Create Playlist
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playlists.map((pl, i) => (
                <motion.div
                  key={pl.id}
                  data-ocid={`library.item.${i + 1}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative bg-card rounded-xl overflow-hidden cursor-pointer hover:bg-accent transition-colors shadow-card"
                  onClick={() => navigate("playlist", pl.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      navigate("playlist", pl.id);
                  }}
                >
                  <div className="aspect-square bg-accent flex items-center justify-center">
                    {pl.songs.length > 0 ? (
                      <div className="grid grid-cols-2 w-full h-full">
                        {pl.songs.slice(0, 4).map((songId) => {
                          const song = songCache[songId];
                          return song ? (
                            <img
                              key={songId}
                              src={song.thumbnail}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              key={songId}
                              className="w-full h-full bg-muted flex items-center justify-center"
                            >
                              <Music className="w-4 h-4 text-muted-foreground" />
                            </div>
                          );
                        })}
                        {pl.songs.length < 4 &&
                          EMPTY_SLOTS.slice(
                            0,
                            4 - Math.min(pl.songs.length, 4),
                          ).map((k) => (
                            <div key={k} className="w-full h-full bg-muted" />
                          ))}
                      </div>
                    ) : (
                      <Music className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {pl.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pl.songs.length} songs
                    </p>
                  </div>

                  <div
                    className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      data-ocid={`library.edit_button.${i + 1}`}
                      onClick={() => {
                        setRenameId(pl.id);
                        setRenameName(pl.name);
                      }}
                      className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      data-ocid={`library.delete_button.${i + 1}`}
                      onClick={() => setDeleteId(pl.id)}
                      className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-red-400 hover:bg-black/80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && (
        <div data-ocid="library.history.panel">
          {history.length === 0 ? (
            <motion.div
              data-ocid="library.empty_state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No history yet
              </h3>
              <p className="text-muted-foreground text-sm">
                Songs you play will appear here
              </p>
            </motion.div>
          ) : (
            <ScrollArea className="h-[70vh]">
              <div className="space-y-6">
                {GROUP_ORDER.filter((g) => grouped[g]?.length > 0).map(
                  (group) => (
                    <div key={group}>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        {group}
                      </h3>
                      <div className="space-y-1">
                        {grouped[group].map((entry, i) => (
                          <motion.button
                            key={`${entry.song.videoId}-${entry.timestamp}`}
                            type="button"
                            data-ocid={`history.item.${i + 1}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left group"
                            onClick={() => {
                              usePlayerStore
                                .getState()
                                .playSong(entry.song, [entry.song]);
                            }}
                          >
                            <img
                              src={entry.song.thumbnail}
                              alt={entry.song.title}
                              className="w-10 h-10 rounded object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                {entry.song.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {entry.song.channel}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatRelativeTime(entry.timestamp)}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent
          data-ocid="library.dialog"
          className="bg-popover border-border"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Create Playlist
            </DialogTitle>
          </DialogHeader>
          <Input
            data-ocid="library.input"
            placeholder="Playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="bg-accent border-border text-foreground"
          />
          <DialogFooter>
            <Button
              data-ocid="library.cancel_button"
              variant="ghost"
              onClick={() => setShowCreate(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              data-ocid="library.confirm_button"
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="bg-primary text-primary-foreground"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent
          data-ocid="library.dialog"
          className="bg-popover border-border"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Rename Playlist
            </DialogTitle>
          </DialogHeader>
          <Input
            data-ocid="library.input"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="bg-accent border-border text-foreground"
          />
          <DialogFooter>
            <Button
              data-ocid="library.cancel_button"
              variant="ghost"
              onClick={() => setRenameId(null)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              data-ocid="library.confirm_button"
              onClick={handleRename}
              disabled={!renameName.trim()}
              className="bg-primary text-primary-foreground"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent
          data-ocid="library.dialog"
          className="bg-popover border-border"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete Playlist?
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              data-ocid="library.cancel_button"
              variant="ghost"
              onClick={() => setDeleteId(null)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              data-ocid="library.delete_button"
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
