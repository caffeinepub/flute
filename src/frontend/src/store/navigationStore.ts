import { create } from "zustand";

export type Page =
  | "home"
  | "search"
  | "library"
  | "playlist"
  | "liked"
  | "history"
  | "settings"
  | "nowplaying";

interface NavigationState {
  page: Page;
  playlistId: bigint | null;
  previousPage: Page | null;
  navigate: (page: Page, playlistId?: bigint) => void;
  goBack: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  page: "home",
  playlistId: null,
  previousPage: null,

  navigate: (page: Page, playlistId?: bigint) => {
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
