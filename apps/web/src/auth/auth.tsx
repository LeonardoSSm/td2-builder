import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/http";

export type Me = {
  id: string;
  name: string;
  email?: string;
  profile: {
    id: string;
    name: string;
    permissions: string[];
  };
};

type AuthContextValue = {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPerm: (perm: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(raw: string): string {
  // Handle common paste/autofill artifacts:
  // - trailing punctuation (.,;:) including non-ASCII dots
  // - accidental spaces
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u002e\u2024\u3002\uFF0E]+$/g, "") // . (ascii) + dot-like unicode
    .replace(/[.,;:]+$/g, "");
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const hasPerm = (perm: string) => {
    const perms = me?.profile?.permissions ?? [];
    return perms.includes(perm);
  };

  const logout = () => {
    setMe(null);
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password ?? "");
    const res = await apiPost<{ user: Me }>("/auth/login", {
      email: normalizedEmail,
      password: normalizedPassword,
    });
    setMe(res.user);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await apiGet<Me>("/auth/me");
        if (!cancelled) setMe(res);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ me, loading, login, logout: async () => {
      try {
        await apiPost("/auth/logout", {});
      } catch {
        // ignore; we still clear local state
      }
      logout();
    }, hasPerm }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
