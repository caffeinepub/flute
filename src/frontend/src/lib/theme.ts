// OKLCH hue values for each theme
// Format: [lightness, chroma, hue]
export type ThemeColor =
  | "green"
  | "red"
  | "violet"
  | "blue"
  | "orange"
  | "pink";

interface ThemeConfig {
  label: string;
  primary: [number, number, number]; // [L, C, H]
  ring: [number, number, number];
  swatch: string; // for display in picker
}

export const THEMES: Record<ThemeColor, ThemeConfig> = {
  green: {
    label: "Green",
    primary: [0.72, 0.18, 145.6],
    ring: [0.72, 0.18, 145.6],
    swatch: "oklch(0.72 0.18 145.6)",
  },
  red: {
    label: "Red",
    primary: [0.65, 0.22, 25],
    ring: [0.65, 0.22, 25],
    swatch: "oklch(0.65 0.22 25)",
  },
  violet: {
    label: "Violet",
    primary: [0.68, 0.2, 280],
    ring: [0.68, 0.2, 280],
    swatch: "oklch(0.68 0.2 280)",
  },
  blue: {
    label: "Blue",
    primary: [0.68, 0.19, 240],
    ring: [0.68, 0.19, 240],
    swatch: "oklch(0.68 0.19 240)",
  },
  orange: {
    label: "Orange",
    primary: [0.72, 0.2, 50],
    ring: [0.72, 0.2, 50],
    swatch: "oklch(0.72 0.2 50)",
  },
  pink: {
    label: "Pink",
    primary: [0.7, 0.2, 340],
    ring: [0.7, 0.2, 340],
    swatch: "oklch(0.7 0.2 340)",
  },
};

export function applyTheme(color: ThemeColor) {
  const cfg = THEMES[color];
  const [l, c, h] = cfg.primary;
  const val = `${l} ${c} ${h}`;
  const root = document.documentElement;
  root.style.setProperty("--primary", val);
  root.style.setProperty("--ring", val);
  root.style.setProperty("--chart-1", val);
  root.style.setProperty("--sidebar-primary", val);
  root.style.setProperty("--sidebar-ring", val);
  localStorage.setItem("flute_theme", color);
}

export function loadSavedTheme() {
  const saved = localStorage.getItem("flute_theme") as ThemeColor | null;
  if (saved && THEMES[saved]) {
    applyTheme(saved);
    return saved;
  }
  return "green" as ThemeColor;
}
