import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, tokenStore } from "@/services/api";

type AppRole = "responsable_domaine" | "responsable_central" | "direction";

export interface UserInfo {
  role: AppRole | null;
  domaineId: string | null;
  nomComplet: string | null;
  email: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  // "session" kept for compatibility with App.tsx ProtectedRoute
  session: AuthUser | null;
  user: AuthUser | null;
  userInfo: UserInfo;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nomComplet?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const DEMO_USER: AuthUser = { id: "demo-admin-id", email: "admin-demo@domaines.co.ma" };

const DEMO_USER_INFO: UserInfo = {
  role: "responsable_central",
  domaineId: null,
  nomComplet: "Admin Démo",
  email: "admin-demo@domaines.co.ma",
};

function b64url(obj: unknown) {
  return btoa(JSON.stringify(obj))
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeDemoToken() {
  const header = b64url({ alg: "none", typ: "JWT" });
  const body = b64url({
    sub: DEMO_USER.id,
    email: DEMO_USER.email,
    role: DEMO_USER_INFO.role,
    domaineId: DEMO_USER_INFO.domaineId,
    nomComplet: DEMO_USER_INFO.nomComplet,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    demo: true,
  });
  return `${header}.${body}.demo`;
}

const fallbackAuthContext: AuthContextType = {
  session: DEMO_USER,
  user: DEMO_USER,
  userInfo: DEMO_USER_INFO,
  loading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => undefined,
};

const AuthContext = createContext<AuthContextType>(fallbackAuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    role: null, domaineId: null, nomComplet: null, email: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      let token = tokenStore.get();
      if (!token) {
        token = makeDemoToken();
        tokenStore.set(token);
        setUser(DEMO_USER);
        setUserInfo(DEMO_USER_INFO);
        setLoading(false);
        return;
      }

      try {
        const payloadB64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadB64));

        // Vérifier expiration
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          const demoToken = makeDemoToken();
          tokenStore.set(demoToken);
          setUser(DEMO_USER);
          setUserInfo(DEMO_USER_INFO);
          setLoading(false);
          return;
        }

        // Démo : token local, pas d'appel backend
        if (payload.demo) {
          setUser({ id: payload.sub, email: payload.email });
          setUserInfo({
            role: payload.role as AppRole,
            domaineId: payload.domaineId ?? null,
            nomComplet: payload.nomComplet ?? null,
            email: payload.email,
          });
          setLoading(false);
          return;
        }

        const profile = await authApi.me();
        setUser({ id: payload.sub, email: payload.email });
        setUserInfo({
          role: payload.role as AppRole,
          domaineId: payload.domaineId ?? null,
          nomComplet: profile.nomComplet ?? null,
          email: profile.email,
        });

      } catch {
        tokenStore.clear();
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { token, user: u } = await authApi.login(email, password);
      tokenStore.set(token);
      const profile = await authApi.me();
      setUser({ id: u.sub, email: u.email });
      setUserInfo({
        role: u.role as AppRole,
        domaineId: u.domaineId,
        nomComplet: profile.nomComplet ?? null,
        email: u.email,
      });
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message) };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    nomComplet = "",
  ): Promise<{ error: Error | null }> => {
    try {
      await authApi.register(email, password, nomComplet, "direction");
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message) };
    }
  };

  const signOut = async () => {
    tokenStore.clear();
    setUser(null);
    setUserInfo({ role: null, domaineId: null, nomComplet: null, email: null });
  };

  return (
    // session = user (même objet) pour compatibilité avec App.tsx
    <AuthContext.Provider value={{ session: user, user, userInfo, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
