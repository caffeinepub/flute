import { cn } from "@/lib/utils";
import { BookOpen, House, Music, Search, Sparkles } from "lucide-react";
import { type Page, useNavigationStore } from "../store/navigationStore";

const NAV_ITEMS: { label: string; page: Page; icon: React.ReactNode }[] = [
  { label: "Home", page: "home", icon: <House className="w-5 h-5" /> },
  { label: "Search", page: "search", icon: <Search className="w-5 h-5" /> },
  { label: "Meel", page: "meel", icon: <Sparkles className="w-5 h-5" /> },
  { label: "Library", page: "library", icon: <BookOpen className="w-5 h-5" /> },
  {
    label: "Now Playing",
    page: "nowplaying",
    icon: <Music className="w-5 h-5" />,
  },
];

export function BottomNav() {
  const { page, navigate } = useNavigationStore();

  return (
    <nav
      data-ocid="bottomnav.panel"
      className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-sidebar-border z-40 flex items-center justify-around px-2 lg:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.page}
          type="button"
          data-ocid={`bottomnav.${item.page}.link`}
          onClick={() => navigate(item.page)}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0 flex-1",
            page === item.page
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.icon}
          <span className="text-[10px] font-medium truncate">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
