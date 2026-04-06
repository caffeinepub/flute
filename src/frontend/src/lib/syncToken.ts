// Generates and retrieves a unique 6-character alphanumeric sync token per user
// Stored in localStorage under a stable key

const TOKEN_KEY = "flute_sync_token";

export function getOrCreateSyncToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function resetSyncToken(): string {
  localStorage.removeItem(TOKEN_KEY);
  return getOrCreateSyncToken();
}
