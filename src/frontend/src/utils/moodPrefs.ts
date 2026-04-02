const MOOD_KEYWORDS: Record<string, string[]> = {
  chill: [
    "chill",
    "lofi",
    "lo-fi",
    "relax",
    "calm",
    "sleep",
    "study",
    "ambient",
  ],
  energetic: [
    "workout",
    "gym",
    "energy",
    "hype",
    "bass",
    "edm",
    "dance",
    "party",
  ],
  sad: ["sad", "cry", "heartbreak", "lonely", "miss", "emotional", "tears"],
  happy: ["happy", "joy", "fun", "upbeat", "good vibes", "feel good"],
  romantic: ["love", "romance", "baby", "heart", "forever", "together"],
};

const STORAGE_KEY = "flute_mood_prefs";

export function classifyMood(title: string): string {
  const lower = title.toLowerCase();
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return mood;
  }
  return "general";
}

export function getMoodPrefs(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setMoodPrefs(prefs: Record<string, number>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function reinforcePositive(mood: string, artist: string): void {
  const prefs = getMoodPrefs();
  prefs[mood] = (prefs[mood] || 0) + 1;
  const artistKey = `artist:${artist}`;
  prefs[artistKey] = (prefs[artistKey] || 0) + 1;
  setMoodPrefs(prefs);
}

export function reinforceNegative(mood: string, artist: string): void {
  const prefs = getMoodPrefs();
  prefs[mood] = (prefs[mood] || 0) - 2;
  const artistKey = `artist:${artist}`;
  prefs[artistKey] = (prefs[artistKey] || 0) - 2;
  setMoodPrefs(prefs);
}

export function scoreTrack(title: string, artist: string): number {
  const prefs = getMoodPrefs();
  const mood = classifyMood(title);
  const moodScore = prefs[mood] || 0;
  const artistScore = prefs[`artist:${artist}`] || 0;
  return moodScore + artistScore;
}
