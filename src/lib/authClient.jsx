import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, setStoredToken } from "./apiClient.js";

const AuthContext = createContext(null);

function normalizeSession(payload) {
  if (!payload?.user) return null;
  const user = {
    ...payload.user,
    id: payload.user.id,
    email: payload.user.email || payload.user.username,
    user_metadata: payload.user.user_metadata || {
      display_name: payload.user.display_name || payload.user.username,
    },
  };
  return {
    user,
    workspaceId: payload.workspaceId || "default",
    workspaceRole: payload.workspaceRole || user.role || "reader",
    isDemo: false,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiGet("/auth/me")
      .then((payload) => {
        if (mounted) setSession(normalizeSession(payload));
      })
      .catch(() => {
        setStoredToken("");
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(() => ({
    loading,
    session,
    user: session?.user || null,
    workspaceId: session?.workspaceId || "default",
    workspaceRole: session?.workspaceRole || "reader",
    isDemo: false,
    isConfigured: true,
    async signInWithPassword({ email, password }) {
      try {
        const payload = await apiPost("/auth/login", {
          username: email,
          password,
        });
        setStoredToken(payload.token);
        const nextSession = normalizeSession(payload);
        setSession(nextSession);
        return { data: { session: nextSession }, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async signOut() {
      try {
        await apiPost("/auth/logout", {});
      } catch {
        // local logout still wins
      }
      setStoredToken("");
      setSession(null);
    },
  }), [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
