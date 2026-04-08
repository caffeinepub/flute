import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bell,
  Check,
  ClipboardCopy,
  Clock,
  Globe,
  LogOut,
  Palette,
  RefreshCw,
  Settings as SettingsIcon,
  Share2,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocalAuth } from "../hooks/useLocalAuth";
import { getOrCreateSyncToken, resetSyncToken } from "../lib/syncToken";
import {
  THEMES,
  type ThemeColor,
  applyTheme,
  loadSavedTheme,
} from "../lib/theme";
import { usePlayerStore } from "../store/playerStore";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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

// Pill toggle component used for binary settings
function ToggleSwitch({
  enabled,
  onToggle,
  id,
}: { enabled: boolean; onToggle: () => void; id: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      id={id}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        enabled ? "bg-primary border-primary" : "bg-accent border-border"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function Settings() {
  const { user, logout } = useLocalAuth();
  const { stickyNotification, setStickyNotification } = usePlayerStore();

  const [editName, setEditName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeColor>("green");

  // Sleep timer state
  const [sleepEndTime, setSleepEndTime] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync token state
  const [syncToken, setSyncToken] = useState(() => getOrCreateSyncToken());

  // PWA install state
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // External API toggle state
  const [useExternalApi, setUseExternalApi] = useState<boolean>(() => {
    try {
      return localStorage.getItem("flute_use_external_api") === "true";
    } catch {
      return false;
    }
  });
  const [externalApiUrl, setExternalApiUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("flute_external_api_url") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    setEditName(user?.username || "");
    setActiveTheme(loadSavedTheme());
  }, [user]);

  // PWA install prompt listener
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    const prompt = installPrompt as BeforeInstallPromptEvent;
    await prompt.prompt();
    setInstallPrompt(null);
  };

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

  const handleCopyToken = () => {
    navigator.clipboard
      .writeText(syncToken)
      .then(() => toast.success("Token copied!"))
      .catch(() => toast.error("Failed to copy"));
  };

  const handleResetToken = () => {
    const newToken = resetSyncToken();
    setSyncToken(newToken);
    toast.success("New Sync Token generated");
  };

  const handleShareApp = () => {
    const url = window.location.origin;
    const text = `🎵 Join me on Flute! Use Sync Token: ${syncToken}\n${url}`;
    if (navigator.share) {
      navigator.share({ title: "Flute Music", text, url }).catch(() => {});
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success("Link copied to clipboard!"))
        .catch(() => toast.error("Failed to copy"));
    }
  };

  const handleToggleExternalApi = () => {
    const next = !useExternalApi;
    setUseExternalApi(next);
    try {
      localStorage.setItem("flute_use_external_api", String(next));
    } catch {}
    toast.success(next ? "External API enabled" : "Using Piped (default)");
  };

  const handleExternalApiUrlChange = (val: string) => {
    setExternalApiUrl(val);
    try {
      localStorage.setItem("flute_external_api_url", val);
    } catch {}
  };

  // Format token as pairs: AB CD EF
  const formattedToken = `${syncToken.slice(0, 2)} ${syncToken.slice(2, 4)} ${syncToken.slice(4, 6)}`;

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

        {/* Music Source — External API toggle */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Music Source
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Switch between Piped (default) and your own recommendations API.
          </p>

          {/* Toggle row */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label
                htmlFor="external-api-toggle"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Use External API
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {useExternalApi
                  ? "Fetching recommendations from your API"
                  : "Using Piped for music recommendations"}
              </p>
            </div>
            <ToggleSwitch
              id="external-api-toggle"
              enabled={useExternalApi}
              onToggle={handleToggleExternalApi}
            />
          </div>

          {/* API URL input — shown only when enabled */}
          {useExternalApi && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 space-y-2"
            >
              <Label className="text-muted-foreground text-xs block">
                API Endpoint URL
              </Label>
              <Input
                data-ocid="settings.api_url_input"
                value={externalApiUrl}
                onChange={(e) => handleExternalApiUrlChange(e.target.value)}
                placeholder="https://your-api.com/recommendations"
                className="bg-accent border-border text-foreground text-sm"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Override Piped with your own music API. Response must be a JSON
                array of{" "}
                <span className="font-mono text-foreground/70 text-xs">
                  {"{title, uploader, duration, streamUrl, thumbnail, videoId}"}
                </span>
              </p>
            </motion.div>
          )}
        </motion.section>

        {/* Persistent Notification */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.095 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Notifications
            </h2>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label
                htmlFor="sticky-notif-toggle"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Persistent Notification
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notification reappears after being dismissed
              </p>
            </div>
            <ToggleSwitch
              id="sticky-notif-toggle"
              enabled={stickyNotification}
              onToggle={() => setStickyNotification(!stickyNotification)}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Keep playback notification visible even after dismissal — like real
            music apps.
          </p>
        </motion.section>

        {/* Sync Token */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🔑</span>
            <h2 className="text-lg font-semibold text-foreground">
              Sync Token
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Share this code with friends to sync your music taste.
          </p>

          {/* Token display */}
          <div className="flex flex-col items-center gap-4 py-4 px-4 rounded-xl bg-accent/60 border border-border mb-4">
            <span
              data-ocid="settings.panel"
              className="tracking-[0.3em] font-mono text-3xl text-primary font-bold select-all"
            >
              {formattedToken}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-ocid="settings.primary_button"
                onClick={handleCopyToken}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <ClipboardCopy className="w-4 h-4" />
                Copy
              </button>
              <button
                type="button"
                data-ocid="settings.secondary_button"
                onClick={handleResetToken}
                title="Generate new token"
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your token:{" "}
            <span className="font-mono text-foreground">{syncToken}</span>
          </p>
        </motion.section>

        {/* Share App */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-card rounded-xl p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Share Flute
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invite friends with your Sync Token
              </p>
            </div>
            <button
              type="button"
              data-ocid="settings.open_modal_button"
              onClick={handleShareApp}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-sm font-medium transition-colors border border-primary/20"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </motion.section>

        {/* Install App */}
        {(installPrompt || isInstalled) && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            className="bg-card rounded-xl p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Install Flute
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isInstalled
                    ? "App is installed on your device"
                    : "Add to your home screen for the best experience"}
                </p>
              </div>
              {isInstalled ? (
                <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 text-sm font-medium border border-green-500/20">
                  <Check className="w-4 h-4" />
                  Installed
                </span>
              ) : (
                <button
                  type="button"
                  data-ocid="settings.install_button"
                  onClick={handleInstall}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
                >
                  Install App
                </button>
              )}
            </div>
          </motion.section>
        )}

        {/* Refresh */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
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
          transition={{ delay: 0.16 }}
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
