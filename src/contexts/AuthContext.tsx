import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserInfo {
  role: AppRole | null;
  domaineId: number | null;
  nomComplet: string | null;
  email: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userInfo: UserInfo;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo>({ role: null, domaineId: null, nomComplet: null, email: null });
  const [loading, setLoading] = useState(true);

  const fetchUserInfo = async (userId: string, userEmail?: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role, domaine_id").eq("user_id", userId),
      supabase.from("profiles").select("nom_complet, email").eq("id", userId).maybeSingle(),
    ]);
    const roles = rolesRes.data || [];
    // Prioritize responsable_central > direction > responsable_domaine
    const priorityOrder = ["responsable_central", "direction", "responsable_domaine"];
    const sortedRoles = [...roles].sort((a, b) => priorityOrder.indexOf(a.role) - priorityOrder.indexOf(b.role));
    const primaryRole = sortedRoles[0] || null;
    // For responsable_central, get domaine_id from their responsable_domaine role if exists
    const domaineRole = roles.find(r => r.domaine_id != null);
    setUserInfo({
      role: primaryRole?.role ?? null,
      domaineId: domaineRole?.domaine_id ?? null,
      nomComplet: profileRes.data?.nom_complet ?? null,
      email: profileRes.data?.email ?? userEmail ?? null,
    });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserInfo(session.user.id), 0);
      } else {
        setUserInfo({ role: null, domaineId: null, nomComplet: null, email: null });
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserInfo(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, userInfo, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
