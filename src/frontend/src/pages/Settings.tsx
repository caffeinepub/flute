import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  LogOut,
  Palette,
  Settings as SettingsIcon,
  User,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocalAuth } from "../hooks/useLocalAuth";
import {
  THEMES,
  type ThemeColor,
  applyTheme,
  loadSavedTheme,
} from "../lib/theme";

type ApiStatus = "idle" | "testing" | "ok" | "error";

export function Settings() {
  const { user, logout } = useLocalAuth();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle");
  const [apiError, setApiError] = useState("");
  const [activeTheme, setActiveTheme] = useState<ThemeColor>("green");

  useEffect(() => {
    const stored = localStorage.getItem("yt_api_key") || "";
    setApiKey(stored);
    setEditName(user?.username || "");
    setActiveTheme(loadSavedTheme());
  }, [user]);

  const handleSaveApiKey = () => {
    localStorage.setItem("yt_api_key", apiKey.trim());
    setKeySaved(true);
    setApiStatus("idle");
    setTimeout(() => setKeySaved(false), 2000);
    toast.success("API key saved");
  };

  const handleTestApiKey = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setApiStatus("testing");
    setApiError("");
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=music&type=video&maxResults=1&key=${key}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setApiStatus("ok");
        toast.success("API key is working!");
      } else {
        const msg =
          data.error?.message || `HTTP ${res.status}: invalid response`;
        setApiStatus("error");
        setApiError(msg);
        toast.error("API key test failed");
      }
    } catch {
      setApiStatus("error");
      setApiError("Network error. Check your connection.");
      toast.error("Network error");
    }
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

  return (
    <div className="px-6 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="space-y-8">
        {/* Profile */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-6 shadow-card"
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

        {/* YouTube API Key */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-6 shadow-card"
        >
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              YouTube API Key
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Required for searching and fetching related songs. Your key is
            stored locally and never sent to our servers.
          </p>

          <div className="space-y-3">
            <div className="relative">
              <Input
                data-ocid="settings.input"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setApiStatus("idle");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                placeholder="AIza..."
                className="bg-accent border-border text-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <Button
                data-ocid="settings.save_button"
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
              >
                {keySaved ? (
                  <>
                    <Check className="w-4 h-4 mr-2" /> Saved!
                  </>
                ) : (
                  "Save API Key"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestApiKey}
                disabled={!apiKey.trim() || apiStatus === "testing"}
                className="border-border text-foreground hover:bg-accent gap-2"
              >
                {apiStatus === "testing" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : apiStatus === "ok" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : apiStatus === "error" ? (
                  <XCircle className="w-4 h-4 text-destructive" />
                ) : null}
                Test
              </Button>
            </div>

            {apiStatus === "ok" && (
              <p className="text-sm text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> API key is valid and
                working.
              </p>
            )}
            {apiStatus === "error" && (
              <p className="text-sm text-destructive flex items-start gap-1.5">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {apiError}
              </p>
            )}

            <div className="bg-accent rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                How to get your free API key:
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to Google Cloud Console</li>
                <li>Create a new project (or select an existing one)</li>
                <li>Enable the &ldquo;YouTube Data API v3&rdquo;</li>
                <li>Go to Credentials → Create API Key</li>
                <li>Copy the key and paste it above</li>
              </ol>
              <a
                href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
              >
                Open Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </motion.section>

        {/* Color Theme */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-6 shadow-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Accent Color
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Choose the accent color used throughout the app.
          </p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(THEMES) as ThemeColor[]).map((color) => {
              const isActive = activeTheme === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleThemeChange(color)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-sm font-medium ${
                    isActive
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: THEMES[color].swatch }}
                  />
                  {THEMES[color].label}
                  {isActive && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* Sign Out */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl p-6 shadow-card"
        >
          <Button
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
