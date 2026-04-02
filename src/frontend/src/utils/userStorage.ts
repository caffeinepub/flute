export function getUserStorageKey(key: string, username?: string): string {
  if (!username) {
    try {
      const raw = localStorage.getItem("flute_user");
      if (raw) {
        const user = JSON.parse(raw);
        return `flute_${user.username}_${key}`;
      }
    } catch {
      // ignore
    }
    return `flute_guest_${key}`;
  }
  return `flute_${username}_${key}`;
}

export function userGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(getUserStorageKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function userSet(key: string, value: unknown): void {
  localStorage.setItem(getUserStorageKey(key), JSON.stringify(value));
}

export function userRemove(key: string): void {
  localStorage.removeItem(getUserStorageKey(key));
}
