import React, { createContext, useContext, useState, useEffect } from "react";
import { MOCK_USERS } from "./mockCredentials";

type User = { id: string; email: string; name: string };

type AuthContext = {
  user: User | null;
  signin: (email: string, password: string) => Promise<boolean>;
  signout: () => void;
};

const ctx = createContext<AuthContext | undefined>(undefined);

const STORAGE_KEY = "auth_user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const signin = async (email: string, password: string) => {
    const found = MOCK_USERS.find((u) => u.email === email && u.password === password);
    if (found) {
      const userData = { id: found.id, email: found.email, name: found.name };
      setUser(userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const signout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return <ctx.Provider value={{ user, signin, signout }}>{children}</ctx.Provider>;
};

export const useAuth = () => {
  const v = useContext(ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
};
