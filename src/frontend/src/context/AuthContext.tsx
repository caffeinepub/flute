import { type ReactNode, createContext, useCallback, useState } from "react";

export type LocalUser = {
  username: string;
  isGuest: boolean;
};

const STORAGE_KEY = "flute_user";

function loadUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
}

type AuthContextType = {
  user: LocalUser | null;
  login: (username: string) => void;
  loginAsGuest: () => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  loginAsGuest: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(loadUser);

  const login = useCallback((username: string) => {
    const u: LocalUser = { username: username.trim(), isGuest: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const loginAsGuest = useCallback(() => {
    const u: LocalUser = { username: "Guest", isGuest: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
