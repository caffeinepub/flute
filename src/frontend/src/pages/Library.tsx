import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Edit2,
  Library as LibraryIcon,
  Loader2,
  Music,
  Plus,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { PlaylistView } from "../backend";
import { SongCard } from "../components/SongCard/SongCard";
import {
  useAllPlaylists,
  useAllSongs,
  useCreatePlaylist,
  useDeletePlaylist,
  useRenamePlaylist,
} from "../hooks/useQueries";
import { useNavigationStore } from "../store/navigationStore";

const SKEL_8 = ["sk0", "sk1", "sk2", "sk3", "sk4", "sk5", "sk6", "sk7"];
const EMPTY_SLOTS = ["e0", "e1", "e2", "e3"];

export function Library() {
  const { data: playlists = [], isLoading } = useAllPlaylists();
  const { data: allSongs = [] } = useAllSongs();
  const createPlaylist = useCreatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const renamePlaylist = useRenamePlaylist();
  const { navigate } = useNavigationStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<bigint | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<bigint | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPlaylist.mutateAsync(newName.trim());
    setNewName("");
    setShowCreate(false);
    toast.success("Playlist created");
  };

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;
    await renamePlaylist.mutateAsync({
      playlistId: renameId,
      name: renameName.trim(),
    });
    setRenameId(null);
    toast.success("Playlist renamed");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deletePlaylist.mutateAsync(deleteId);
    setDeleteId(null);
    toast.success("Playlist deleted");
  };

  return (
    <div className="px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Your Library</h1>
        <Button
          data-ocid="library.open_modal_button"
          onClick={() => setShowCreate(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-9 px-4"
        >
          <Plus className="w-4 h-4 mr-1" /> New Playlist
        </Button>
      </div>

      {isLoading ? (
        <div
          data-ocid="library.loading_state"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {SKEL_8.map((k) => (
            <div key={k} className="space-y-3">
              <Skeleton className="aspect-square rounded-xl bg-accent" />
              <Skeleton className="h-4 rounded bg-accent" />
            </div>
          ))}
        </div>
      ) : playlists.length === 0 ? (
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
          {playlists.map((pl: PlaylistView, i) => (
            <motion.div
              key={pl.id.toString()}
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
                      const song = allSongs.find((s) => s.videoId === songId);
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

      {allSongs.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-foreground mb-4">
            All Cached Songs
          </h2>
          <div className="space-y-1">
            {allSongs.map((song, i) => (
              <SongCard
                key={song.videoId}
                song={song}
                queue={allSongs}
                index={i}
                variant="list"
              />
            ))}
          </div>
        </section>
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
              disabled={!newName.trim() || createPlaylist.isPending}
              className="bg-primary text-primary-foreground"
            >
              {createPlaylist.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Create"
              )}
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
              disabled={!renameName.trim() || renamePlaylist.isPending}
              className="bg-primary text-primary-foreground"
            >
              {renamePlaylist.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
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
              disabled={deletePlaylist.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deletePlaylist.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
