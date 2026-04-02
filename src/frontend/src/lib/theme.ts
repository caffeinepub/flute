// OKLCH hue values for each theme
export type ThemeColor =
  | "green"
  | "red"
  | "violet"
  | "blue"
  | "orange"
  | "pink"
  | "yellow"
  | "cyan"
  | "teal"
  | "rose"
  | "indigo"
  | "amber";

interface ThemeConfig {
  label: string;
  primary: [number, number, number]; // [L, C, H]
  ring: [number, number, number];
  swatch: string;
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
  yellow: {
    label: "Yellow",
    primary: [0.8, 0.18, 90],
    ring: [0.8, 0.18, 90],
    swatch: "oklch(0.8 0.18 90)",
  },
  cyan: {
    label: "Cyan",
    primary: [0.72, 0.17, 200],
    ring: [0.72, 0.17, 200],
    swatch: "oklch(0.72 0.17 200)",
  },
  teal: {
    label: "Teal",
    primary: [0.7, 0.16, 175],
    ring: [0.7, 0.16, 175],
    swatch: "oklch(0.7 0.16 175)",
  },
  rose: {
    label: "Rose",
    primary: [0.67, 0.22, 10],
    ring: [0.67, 0.22, 10],
    swatch: "oklch(0.67 0.22 10)",
  },
  indigo: {
    label: "Indigo",
    primary: [0.65, 0.22, 260],
    ring: [0.65, 0.22, 260],
    swatch: "oklch(0.65 0.22 260)",
  },
  amber: {
    label: "Amber",
    primary: [0.75, 0.2, 65],
    ring: [0.75, 0.2, 65],
    swatch: "oklch(0.75 0.2 65)",
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
