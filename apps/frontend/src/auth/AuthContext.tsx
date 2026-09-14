import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setAccessToken as setClientAccessToken, setUnauthorizedHandler } from "../api/client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface AuthUser {
  id: number;
  username: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchMe(token: string): Promise<AuthUser | null> {
  const res = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

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
      .then(async ({ accessToken: token }) => {
        if (cancelled) return;
        // /refresh does not return user identity, so fetch it separately via /auth/me.
        // If that call fails (degraded case), fall back to a null user rather than
        // forcing logout — RequireAuth must treat a non-null accessToken as the
        // authenticated signal, not `user !== null` — see AUTH context value below.
        const me = await fetchMe(token);
        if (cancelled) return;
        applyToken(token, me);
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
      // data.user from /auth/login is only { id, username } — apply it immediately so the
      // session is usable, then upgrade to the fuller roles/permissions shape via /auth/me.
      applyToken(data.accessToken, { ...data.user, roles: [], permissions: [] });
      const me = await fetchMe(data.accessToken);
      if (me) applyToken(data.accessToken, me);
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
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
