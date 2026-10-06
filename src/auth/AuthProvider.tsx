import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuthRepo } from "../data/factory";
import type { GoogleAccount } from "../data/repositories";
import type { User } from "../data/types";

type AuthContext = {
  user: User | null;
  loading: boolean;
  signin: (email: string, password: string) => Promise<boolean>;
  signinWithGoogleAccount: (
    account: GoogleAccount,
  ) => Promise<{ ok: boolean; user?: User; picture?: string; error?: string }>;
  signout: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
};

const ctx = createContext<AuthContext | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session via repo so a future HTTP backend needs no UI change.
  useEffect(() => {
    let cancelled = false;
    getAuthRepo()
      .getSession()
      .then((session) => {
        if (!cancelled) setUser(session);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signin = async (email: string, password: string) => {
    try {
      const session = await getAuthRepo().signin(email, password);
      setUser(session);
      return true;
    } catch {
      return false;
    }
  };

  const signinWithGoogleAccount = async (account: GoogleAccount) => {
    try {
      const { user: session, picture } = await getAuthRepo().signinWithGoogleAccount(account);
      setUser(session);
      return { ok: true as const, user: session, picture };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Google sign-in failed." };
    }
  };

  const signout = async () => {
    await getAuthRepo().signout();
    setUser(null);
  };

  const updateName = async (name: string) => {
    const updated = await getAuthRepo().updateName(name);
    setUser(updated);
  };

  return (
    <ctx.Provider value={{ user, loading, signin, signinWithGoogleAccount, signout, updateName }}>
      {children}
    </ctx.Provider>
  );
};

export const useAuth = () => {
  const v = useContext(ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
};
