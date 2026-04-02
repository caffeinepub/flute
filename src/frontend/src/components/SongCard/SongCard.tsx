import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Heart, ListPlus, MoreHorizontal, Play, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Song } from "../../backend";
import {
  useAddSongToPlaylist,
  useAllPlaylists,
  useLikeSong,
  useLikedSongs,
  useUnlikeSong,
} from "../../hooks/useQueries";
import { usePlayerStore } from "../../store/playerStore";

interface SongCardProps {
  song: Song;
  queue?: Song[];
  index?: number;
  variant?: "grid" | "list";
}

export function SongCard({
  song,
  queue,
  index,
  variant = "grid",
}: SongCardProps) {
  const { playSong, addToQueue } = usePlayerStore();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isCurrentSong = currentSong?.videoId === song.videoId;
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const { data: likedSongs = [] } = useLikedSongs();
  const { data: playlists = [] } = useAllPlaylists();
  const likeSong = useLikeSong();
  const unlikeSong = useUnlikeSong();
  const addToPlaylist = useAddSongToPlaylist();

  const isLiked = likedSongs.some((s) => s.videoId === song.videoId);
  const [hovered, setHovered] = useState(false);

  const handlePlay = () => {
    playSong(song, queue || [song]);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiked) {
      unlikeSong.mutate(song.videoId, {
        onSuccess: () => toast.success("Removed from Liked Songs"),
      });
    } else {
      likeSong.mutate(song.videoId, {
        onSuccess: () => toast.success("Added to Liked Songs"),
      });
    }
  };

  const handleAddToPlaylist = (playlistId: bigint, playlistName: string) => {
    addToPlaylist.mutate(
      { playlistId, songId: song.videoId },
      { onSuccess: () => toast.success(`Added to "${playlistName}"`) },
    );
  };

  const ActionsMenu = ({ stopProp }: { stopProp?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-ocid={`song.open_modal_button.${(index ?? 0) + 1}`}
        onClick={stopProp ? (e) => e.stopPropagation() : undefined}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-ocid="song.dropdown_menu"
        align="end"
        className="bg-popover border-border"
      >
        <DropdownMenuItem
          onClick={() => {
            addToQueue(song);
            toast.success("Added to queue");
          }}
          className="cursor-pointer"
        >
          <ListPlus className="w-4 h-4 mr-2" /> Add to queue
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => handleLike(e)}
          className="cursor-pointer"
        >
          <Heart className="w-4 h-4 mr-2" />{" "}
          {isLiked ? "Remove from Liked" : "Add to Liked Songs"}
        </DropdownMenuItem>
        {playlists.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" /> Add to playlist
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-popover border-border">
              {playlists.map((pl) => (
                <DropdownMenuItem
                  key={pl.id.toString()}
                  onClick={() => handleAddToPlaylist(pl.id, pl.name)}
                  className="cursor-pointer"
                >
                  {pl.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === "list") {
    return (
      <div
        data-ocid={`song.item.${(index ?? 0) + 1}`}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-lg group cursor-pointer transition-colors",
          isCurrentSong ? "bg-primary/10" : "hover:bg-accent",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handlePlay}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handlePlay();
        }}
      >
        <div className="w-10 h-10 relative flex-shrink-0">
          <img
            src={song.thumbnail}
            alt={song.title}
            className="w-10 h-10 rounded object-cover"
          />
          {(hovered || isCurrentSong) && (
            <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
              {isCurrentSong && isPlaying && !hovered ? (
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className="w-0.5 bg-primary animate-bounce"
                      style={{
                        height: `${8 + bar * 4}px`,
                        animationDelay: `${bar * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Play className="w-4 h-4 text-white fill-white" />
              )}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium truncate",
              isCurrentSong ? "text-primary" : "text-foreground",
            )}
          >
            {song.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {song.channel}
          </p>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {song.duration}
        </span>
        {/* Like button -- always visible on mobile (opacity-60 base, full on hover/liked) */}
        <button
          type="button"
          data-ocid={`song.toggle.${(index ?? 0) + 1}`}
          onClick={handleLike}
          className={cn(
            "p-1.5 transition-opacity flex-shrink-0",
            isLiked
              ? "opacity-100 text-primary"
              : "opacity-60 hover:opacity-100 text-muted-foreground hover:text-foreground",
          )}
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
        </button>
        {/* Quick add-to-queue button -- always visible on mobile */}
        <button
          type="button"
          data-ocid={`song.secondary_button.${(index ?? 0) + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            addToQueue(song);
            toast.success("Added to queue");
          }}
          className="p-1.5 opacity-60 hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity flex-shrink-0"
          title="Add to queue"
        >
          <ListPlus className="w-4 h-4" />
        </button>
        <ActionsMenu stopProp />
      </div>
    );
  }

  // Grid variant
  return (
    <div
      data-ocid={`song.item.${(index ?? 0) + 1}`}
      className="group relative bg-card rounded-xl p-4 cursor-pointer hover:bg-accent transition-colors shadow-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handlePlay}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handlePlay();
      }}
    >
      <div className="relative mb-4">
        <img
          src={song.thumbnail}
          alt={song.title}
          className="w-full aspect-square rounded-lg object-cover"
        />
        {hovered && (
          <button
            type="button"
            data-ocid={`song.primary_button.${(index ?? 0) + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
            className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          >
            <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
          </button>
        )}
      </div>
      <p
        className={cn(
          "text-sm font-semibold truncate",
          isCurrentSong ? "text-primary" : "text-foreground",
        )}
      >
        {song.title}
      </p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {song.channel}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{song.duration}</p>

      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          data-ocid={`song.toggle.${(index ?? 0) + 1}`}
          onClick={handleLike}
          className={cn(
            "w-7 h-7 rounded-full bg-black/50 flex items-center justify-center",
            isLiked ? "text-primary" : "text-white",
          )}
        >
          <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-current")} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            data-ocid={`song.open_modal_button.${(index ?? 0) + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-ocid="song.dropdown_menu"
            align="end"
            className="bg-popover border-border"
          >
            <DropdownMenuItem
              onClick={() => {
                addToQueue(song);
                toast.success("Added to queue");
              }}
              className="cursor-pointer"
            >
              <ListPlus className="w-4 h-4 mr-2" /> Add to queue
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => handleLike(e)}
              className="cursor-pointer"
            >
              <Heart className="w-4 h-4 mr-2" />{" "}
              {isLiked ? "Remove from Liked" : "Add to Liked Songs"}
            </DropdownMenuItem>
            {playlists.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Plus className="w-4 h-4 mr-2" /> Add to playlist
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover border-border">
                  {playlists.map((pl) => (
                    <DropdownMenuItem
                      key={pl.id.toString()}
                      onClick={() => handleAddToPlaylist(pl.id, pl.name)}
                      className="cursor-pointer"
                    >
                      {pl.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
