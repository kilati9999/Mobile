import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiLogin, apiLogout, apiMe, clearServerUrl, getServerUrl } from "../api/client";
import type { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  booting: boolean;
  serverConfigured: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshServerConfigured: () => Promise<void>;
  forgetServer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [serverConfigured, setServerConfigured] = useState(false);

  const refreshServerConfigured = useCallback(async () => {
    const url = await getServerUrl();
    setServerConfigured(!!url);
  }, []);

  useEffect(() => {
    (async () => {
      await refreshServerConfigured();
      try {
        const me = await apiMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, [refreshServerConfigured]);

  const login = useCallback(async (username: string, password: string) => {
    const u = await apiLogin(username, password);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const forgetServer = useCallback(async () => {
    await clearServerUrl();
    setUser(null);
    setServerConfigured(false);
  }, []);

  const value = useMemo(
    () => ({ user, booting, serverConfigured, login, logout, refreshServerConfigured, forgetServer }),
    [user, booting, serverConfigured, login, logout, refreshServerConfigured, forgetServer]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
