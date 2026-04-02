import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  LogOut,
  Palette,
  Settings as SettingsIcon,
  User,
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

export function Settings() {
  const { user, logout } = useLocalAuth();

  const [editName, setEditName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeColor>("green");

  useEffect(() => {
    setEditName(user?.username || "");
    setActiveTheme(loadSavedTheme());
  }, [user]);

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

        {/* Color Theme */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl p-6 shadow-card"
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
