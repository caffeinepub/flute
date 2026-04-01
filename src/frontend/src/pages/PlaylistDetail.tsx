import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  ChevronLeft,
  Edit2,
  Loader2,
  Music,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { Song } from "../backend";
import { SongCard } from "../components/SongCard/SongCard";
import {
  useAllSongs,
  usePlaylist,
  useRemoveSongFromPlaylist,
  useRenamePlaylist,
} from "../hooks/useQueries";
import { useNavigationStore } from "../store/navigationStore";
import { usePlayerStore } from "../store/playerStore";

interface PlaylistDetailProps {
  playlistId: bigint | null;
}

export function PlaylistDetail({ playlistId }: PlaylistDetailProps) {
  const { goBack } = useNavigationStore();
  const { data: playlist, isLoading } = usePlaylist(playlistId);
  const { data: allSongs = [] } = useAllSongs();
  const removeSong = useRemoveSongFromPlaylist();
  const renamePlaylist = useRenamePlaylist();
  const { playSong } = usePlayerStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const songs: Song[] = (playlist?.songs || [])
    .map((id) => allSongs.find((s) => s.videoId === id))
    .filter((s): s is Song => !!s);

  const handlePlayAll = () => {
    if (songs.length > 0) playSong(songs[0], songs);
  };

  const handleStartEdit = () => {
    setEditName(playlist?.name || "");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!playlistId || !editName.trim()) return;
    await renamePlaylist.mutateAsync({ playlistId, name: editName.trim() });
    setIsEditing(false);
    toast.success("Playlist renamed");
  };

  const handleRemoveSong = (songId: string) => {
    if (!playlistId) return;
    removeSong.mutate(
      { playlistId, songId },
      { onSuccess: () => toast.success("Song removed") },
    );
  };

  if (!playlistId) {
    return (
      <div className="p-8 text-muted-foreground">No playlist selected</div>
    );
  }

  return (
    <div className="px-6 py-8">
      <button
        type="button"
        data-ocid="playlist.secondary_button"
        onClick={goBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      {isLoading ? (
        <div data-ocid="playlist.loading_state" className="space-y-4">
          <Skeleton className="h-8 w-48 bg-accent" />
          <Skeleton className="h-4 w-32 bg-accent" />
          {["sk0", "sk1", "sk2", "sk3", "sk4"].map((k) => (
            <Skeleton key={k} className="h-14 rounded-lg bg-accent" />
          ))}
        </div>
      ) : !playlist ? (
        <div data-ocid="playlist.empty_state" className="text-center py-16">
          <Music className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Playlist not found</p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-6 mb-8">
            <div className="w-40 h-40 bg-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-card overflow-hidden">
              {songs.length > 0 ? (
                <div className="grid grid-cols-2 w-full h-full">
                  {songs.slice(0, 4).map((song) => (
                    <img
                      key={song.videoId}
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  ))}
                  {songs.length < 4 &&
                    ["e0", "e1", "e2", "e3"]
                      .slice(0, 4 - Math.min(songs.length, 4))
                      .map((k) => (
                        <div key={k} className="w-full h-full bg-muted" />
                      ))}
                </div>
              ) : (
                <Music className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Playlist
              </p>
              {isEditing ? (
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    data-ocid="playlist.input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") setIsEditing(false);
                    }}
                    className="text-2xl font-bold bg-accent border-border text-foreground h-auto py-1"
                  />
                  <button
                    type="button"
                    data-ocid="playlist.confirm_button"
                    onClick={handleSaveEdit}
                    className="text-primary hover:text-primary/80"
                  >
                    {renamePlaylist.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    data-ocid="playlist.cancel_button"
                    onClick={() => setIsEditing(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold text-foreground truncate">
                    {playlist.name}
                  </h1>
                  <button
                    type="button"
                    data-ocid="playlist.edit_button"
                    onClick={handleStartEdit}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {songs.length} songs
              </p>
              {songs.length > 0 && (
                <Button
                  data-ocid="playlist.primary_button"
                  onClick={handlePlayAll}
                  className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" /> Play All
                </Button>
              )}
            </div>
          </div>

          {songs.length === 0 ? (
            <div data-ocid="playlist.empty_state" className="text-center py-12">
              <Music className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No songs yet. Search for music to add.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {songs.map((song, i) => (
                <motion.div
                  key={song.videoId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center group"
                >
                  <div className="flex-1 min-w-0">
                    <SongCard
                      song={song}
                      queue={songs}
                      index={i}
                      variant="list"
                    />
                  </div>
                  <button
                    type="button"
                    data-ocid={`playlist.delete_button.${i + 1}`}
                    onClick={() => handleRemoveSong(song.videoId)}
                    className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    title="Remove from playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
