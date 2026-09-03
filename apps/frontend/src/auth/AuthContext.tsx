import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setAccessToken as setClientAccessToken, setUnauthorizedHandler } from "../api/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface AuthUser {
  id: number;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((token: string | null, nextUser: AuthUser | null) => {
    setAccessTokenState(token);
    setUser(nextUser);
    setClientAccessToken(token);
  }, []);

  const clearSession = useCallback(() => {
    applyToken(null, null);
  }, [applyToken]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ accessToken: token }) => {
        if (cancelled) return;
        applyToken(token, user); // user identity not returned by /refresh; re-set on next login, or left null until first /auth/login this session
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => undefined);
        throw new Error(data?.error ?? "Login failed");
      }
      const data = await res.json();
      applyToken(data.accessToken, data.user);
    },
    [applyToken],
  );

  const logout = useCallback(async () => {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }).catch(() => undefined);
    clearSession();
  }, [accessToken, clearSession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
