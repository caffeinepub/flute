import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  Clock,
  LogOut,
  Palette,
  RefreshCw,
  Settings as SettingsIcon,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocalAuth } from "../hooks/useLocalAuth";
import {
  THEMES,
  type ThemeColor,
  applyTheme,
  loadSavedTheme,
} from "../lib/theme";
import { usePlayerStore } from "../store/playerStore";

const SLEEP_OPTIONS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
];

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSecs = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function Settings() {
  const { user, logout } = useLocalAuth();

  const [editName, setEditName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeColor>("green");

  // Sleep timer state
  const [sleepEndTime, setSleepEndTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setEditName(user?.username || "");
    setActiveTheme(loadSavedTheme());
  }, [user]);

  // Countdown tick
  useEffect(() => {
    if (sleepEndTime === null) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRemaining(0);
      return;
    }

    const tick = () => {
      const left = sleepEndTime - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setSleepEndTime(null);
        usePlayerStore.getState().setIsPlaying(false);
        toast.success("Sleep timer ended. Music paused.");
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setRemaining(left);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sleepEndTime]);

  const handleSetSleepTimer = (minutes: number) => {
    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepEndTime(endTime);
    toast.success(`Sleep timer set for ${minutes} minutes`);
  };

  const handleCancelSleepTimer = () => {
    setSleepEndTime(null);
    toast.success("Sleep timer cancelled");
  };

  const handleSaveName = () => {
    if (!editName.trim()) return;
    const stored = JSON.parse(localStorage.getItem("flute_user") || "{}");
    localStorage.setItem(
      "flute_user",
      JSON.stringify({ ...stored, username: editName.trim() }),
    );
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
    toast.success("Name updated");
  };

  const handleThemeChange = (color: ThemeColor) => {
    applyTheme(color);
    setActiveTheme(color);
    toast.success(`Theme changed to ${THEMES[color].label}`);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Profile</h2>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-sm mb-1.5 block">
                Display Name
              </Label>
              <div className="flex gap-2">
                <Input
                  data-ocid="settings.input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  placeholder="Your name"
                  className="bg-accent border-border text-foreground flex-1"
                />
                <Button
                  data-ocid="settings.save_button"
                  onClick={handleSaveName}
                  disabled={!editName.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {nameSaved ? <Check className="w-4 h-4" /> : "Save"}
                </Button>
              </div>
            </div>
            {user?.isGuest && (
              <p className="text-xs text-muted-foreground">
                You are browsing as a guest. Your data is stored locally.
              </p>
            )}
          </div>
        </motion.section>

        {/* Color Theme */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Accent Color
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Choose the accent color used throughout the app.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {(Object.keys(THEMES) as ThemeColor[]).map((color) => {
              const isActive = activeTheme === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleThemeChange(color)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-sm font-medium ${
                    isActive
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: THEMES[color].swatch }}
                  />
                  <span className="truncate">{THEMES[color].label}</span>
                  {isActive && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Sleep Timer */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Sleep Timer
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Automatically pause music after a set time.
          </p>

          {sleepEndTime && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Timer active
                </p>
                <p className="text-xs text-muted-foreground">
                  Pausing in {formatCountdown(remaining)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelSleepTimer}
                className="text-muted-foreground hover:text-foreground text-xs h-7 px-2"
              >
                Cancel
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {SLEEP_OPTIONS.map((opt) => {
              const isActive =
                sleepEndTime !== null &&
                Math.abs(sleepEndTime - Date.now() - opt.minutes * 60 * 1000) <
                  5000;
              return (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => handleSetSleepTimer(opt.minutes)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    isActive
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {sleepEndTime && (
              <button
                type="button"
                onClick={handleCancelSleepTimer}
                className="px-4 py-2 rounded-full border border-destructive/50 text-destructive text-sm font-medium hover:bg-destructive/10 transition-all"
              >
                Off
              </button>
            )}
          </div>
        </motion.section>

        {/* Refresh */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <Button
            variant="outline"
            className="w-full border-border text-foreground hover:bg-accent gap-2"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh App
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Reloads the app to apply all changes.
          </p>
        </motion.section>

        {/* Sign Out */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <Button
            data-ocid="settings.delete_button"
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </motion.section>
      </div>
    </div>
  );
}
