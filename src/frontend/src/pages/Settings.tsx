import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Settings as SettingsIcon,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useSaveProfile, useUserProfile } from "../hooks/useQueries";

export function Settings() {
  const { identity } = useInternetIdentity();
  const { data: profile } = useUserProfile();
  const saveProfile = useSaveProfile();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("yt_api_key") || "";
    setApiKey(stored);
    setEditName(profile?.name || "");
  }, [profile]);

  const handleSaveApiKey = () => {
    localStorage.setItem("yt_api_key", apiKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
    toast.success("API key saved");
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    await saveProfile.mutateAsync({ name: editName.trim() });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
    toast.success("Name updated");
  };

  return (
    <div className="px-6 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="space-y-8">
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
                  disabled={!editName.trim() || saveProfile.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saveProfile.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : nameSaved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
            {identity && (
              <p className="text-xs text-muted-foreground">
                Principal: {identity.getPrincipal().toString()}
              </p>
            )}
          </div>
        </motion.section>

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
                onChange={(e) => setApiKey(e.target.value)}
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

            <Button
              data-ocid="settings.save_button"
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
            >
              {keySaved ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Saved!
                </>
              ) : (
                "Save API Key"
              )}
            </Button>

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
      </div>
    </div>
  );
}
