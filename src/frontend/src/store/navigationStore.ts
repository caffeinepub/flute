import { create } from "zustand";

export type Page =
  | "home"
  | "search"
  | "library"
  | "playlist"
  | "liked"
  | "history"
  | "settings"
  | "nowplaying"
  | "meel";

interface NavigationState {
  page: Page;
  playlistId: string | null;
  previousPage: Page | null;
  navigate: (page: Page, playlistId?: string) => void;
  goBack: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  page: "home",
  playlistId: null,
  previousPage: null,

  navigate: (page: Page, playlistId?: string) => {
    set((s) => ({
      previousPage: s.page,
      page,
      playlistId: playlistId ?? null,
    }));
  },

  goBack: () => {
    set((s) => ({
      page: s.previousPage || "home",
      previousPage: null,
    }));
  },
}));
